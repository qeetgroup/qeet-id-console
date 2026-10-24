// Reports the page's uncaught errors and Web Vitals to the console's own server, never a third
// party. Best effort and bounded: a route's template, never its URL; text redacted and cut before
// it leaves; at most MAX_ERRORS distinct errors a page load; and nothing ever thrown into the app.
import { type MetricType, onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

import { keepaliveFetch } from "@/platform/api/keepalive-fetch";
import { ApiError } from "@/platform/errors/api-error";
import { normalizeError } from "@/platform/errors/normalize-error";
import {
  type ClientReportEvent,
  clientReportEventSchema,
  REPORT_LIMITS,
  reportClientTelemetry,
  routeTemplateSchema,
} from "@/platform/telemetry/client-report";
import { pathTemplate } from "@/platform/telemetry/path-template";
import { redact } from "@/platform/telemetry/redact";

const MAX_ERRORS = 10; // distinct messages reported per page load
const ERROR_FLUSH_DELAY_MS = 2_000; // gathers a burst of errors into one request

type ErrorReport = Extract<ClientReportEvent, { type: "error" }>;
export type ErrorSource = ErrorReport["source"];
export type CaughtErrorSource = Extract<ErrorSource, "error-boundary" | "sensitive-action">;

export type ClientReporter = {
  error(error: unknown, source: ErrorSource): void;
  vital(metric: Pick<MetricType, "id" | "name" | "value" | "rating">): void;
  flush(): void; // sends everything queued
};

type ReporterOptions = {
  send: (events: ClientReportEvent[]) => Promise<unknown>;
  route: () => string | undefined; // the current route's template, e.g. `/users/$userId`
};

// Masks tokens, query strings, emails and IPs, then cuts to the server's bound. The first, wider
// cut bounds the masking's cost, however large the error.
function clean(text: string, max: number): string {
  return (redact(text.slice(0, max * 4)) as string).slice(0, max);
}

// An API error's message is the backend's own text, which may carry internal context: its code
// stands in for it, in the stack too.
function describeError(error: unknown): Omit<ErrorReport, "type" | "source" | "route"> {
  const appError = normalizeError(error);
  const original = error instanceof Error ? error : undefined;
  const fromApi = error instanceof ApiError || appError.httpStatus !== undefined;
  const message = fromApi ? appError.code : (original?.message ?? String(error));
  let stack = original?.stack;
  if (stack && fromApi && original?.message) stack = stack.split(original.message).join(message);
  return {
    name: original ? clean(original.name, REPORT_LIMITS.name) : undefined,
    message: clean(message || "(no message)", REPORT_LIMITS.message),
    stack: stack ? clean(stack, REPORT_LIMITS.stack) : undefined,
    code: clean(appError.code, REPORT_LIMITS.code),
    status: appError.httpStatus,
    requestId: appError.requestId?.slice(0, REPORT_LIMITS.requestId),
  };
}

/** Returns a reporter that dedupes, throttles and batches what it is given into `send`. */
export function createClientReporter({ send, route }: ReporterOptions): ClientReporter {
  const seenMessages = new Set<string>();
  const sentVitals = new Set<string>(); // metric ids: one report per metric per page view
  const pendingVitals = new Map<string, ClientReportEvent>();
  let errors: ClientReportEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Templated once more, in case the router ever hands over a concrete path.
  function routeNow(): string | undefined {
    try {
      const template = route();
      if (!template) return undefined;
      const parsed = routeTemplateSchema.safeParse(pathTemplate(template));
      return parsed.success ? parsed.data : undefined;
    } catch {
      return undefined;
    }
  }

  // Only an event the server will accept is queued, so one bad event can't sink a batch.
  function accepted(event: ClientReportEvent): ClientReportEvent | null {
    const parsed = clientReportEventSchema.safeParse(event);
    return parsed.success ? parsed.data : null;
  }

  function dispatch(batch: ClientReportEvent[]): void {
    try {
      send(batch).catch(() => undefined);
    } catch {
      // Reporting is best effort.
    }
  }

  function flush(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    const events = [...errors, ...pendingVitals.values()];
    for (const id of pendingVitals.keys()) sentVitals.add(id);
    pendingVitals.clear();
    errors = [];
    for (let i = 0; i < events.length; i += REPORT_LIMITS.events) {
      dispatch(events.slice(i, i + REPORT_LIMITS.events));
    }
  }

  return {
    error(error, source) {
      try {
        if (seenMessages.size >= MAX_ERRORS) return;
        const event = accepted({
          type: "error",
          source,
          ...describeError(error),
          route: routeNow(),
        });
        if (event?.type !== "error" || seenMessages.has(event.message)) return;
        seenMessages.add(event.message);
        errors.push(event);
        timer ??= setTimeout(flush, ERROR_FLUSH_DELAY_MS);
      } catch {
        // Reporting is best effort.
      }
    },
    vital(metric) {
      try {
        if (sentVitals.has(metric.id)) return;
        const { name, value, rating } = metric;
        const event = accepted({ type: "vital", name, value, rating, route: routeNow() });
        if (event) pendingVitals.set(metric.id, event);
      } catch {
        // Reporting is best effort.
      }
    },
    flush() {
      try {
        flush();
      } catch {
        // Reporting is best effort.
      }
    },
  };
}

// web-vitals listens on window in the capture phase, so by the time this document listener runs
// on hide, CLS and INP have been reported and are sent in the same request.
function listen(reporter: ClientReporter): void {
  window.addEventListener("error", (event) => {
    // A cross-origin script's error carries only "Script error."
    reporter.error(event.error ?? event.message, "window");
  });
  window.addEventListener("unhandledrejection", (event) => {
    reporter.error(event.reason, "unhandled-rejection");
  });
  const vital = (metric: MetricType) => reporter.vital(metric);
  onCLS(vital);
  onFCP(vital);
  onINP(vital);
  onLCP(vital);
  onTTFB(vital);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") reporter.flush();
  });
  window.addEventListener("pagehide", () => reporter.flush());
}

function sendReport(events: ClientReportEvent[]): Promise<unknown> {
  return reportClientTelemetry({ data: { events }, fetch: keepaliveFetch });
}

let active: ClientReporter | null = null;

/**
 * Starts reporting the page's errors and Web Vitals, once per page load, in a production build in
 * the browser; anywhere else it does nothing. `route` returns the current route's template.
 */
export function startClientTelemetry(route: () => string | undefined): void {
  if (active || typeof window === "undefined" || !import.meta.env.PROD) return;
  try {
    active = createClientReporter({ send: sendReport, route });
    listen(active);
  } catch {
    // Reporting must never stop the app from starting.
  }
}

/** Reports an error the app caught itself; a no-op until reporting has started. */
export function reportCaughtError(error: unknown, source: CaughtErrorSource): void {
  active?.error(error, source);
}
