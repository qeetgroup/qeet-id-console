// The endpoint the browser reports its crashes and Web Vitals to: a server function, so the CSRF
// middleware checks every call. It accepts only the fields below, within their bounds, and writes
// each event to the server log, which redacts it again.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { pathTemplate } from "@/platform/telemetry/path-template";
import { serverLog } from "@/platform/telemetry/server-log";

/** The bounds a report must fit: the browser cuts to them, the server refuses anything larger. */
export const REPORT_LIMITS = {
  events: 20, // per request; keeps a page-hide report well under keepalive's 64 KB
  message: 500,
  stack: 2000,
  name: 100,
  code: 100,
  requestId: 200,
  route: 200,
} as const;

/** A route's template as the router names it (`/users/$userId`): no query, fragment or email. */
export const routeTemplateSchema = z
  .string()
  .max(REPORT_LIMITS.route)
  .regex(/^\/[\w$.{}/-]*$/);

const vitalSchema = z.strictObject({
  type: z.literal("vital"),
  name: z.enum(["CLS", "FCP", "INP", "LCP", "TTFB"]),
  value: z.number().min(0).max(3_600_000), // milliseconds, or CLS's unitless score
  rating: z.enum(["good", "needs-improvement", "poor"]),
  route: routeTemplateSchema.optional(),
});

const errorSchema = z.strictObject({
  type: z.literal("error"),
  source: z.enum(["window", "unhandled-rejection", "error-boundary", "sensitive-action"]),
  name: z.string().max(REPORT_LIMITS.name).optional(),
  message: z.string().max(REPORT_LIMITS.message),
  stack: z.string().max(REPORT_LIMITS.stack).optional(),
  code: z.string().max(REPORT_LIMITS.code).optional(),
  status: z.number().int().min(0).max(599).optional(),
  requestId: z.string().max(REPORT_LIMITS.requestId).optional(),
  route: routeTemplateSchema.optional(),
});

export const clientReportEventSchema = z.discriminatedUnion("type", [vitalSchema, errorSchema]);

export const clientReportSchema = z.strictObject({
  events: z.array(clientReportEventSchema).min(1).max(REPORT_LIMITS.events),
});

export type ClientReportEvent = z.infer<typeof clientReportEventSchema>;

// The route is templated again here: the browser is not trusted to have left an id out.
function logReportEvent(event: ClientReportEvent): void {
  const route = event.route === undefined ? undefined : pathTemplate(event.route);
  if (event.type === "vital") {
    const value =
      event.name === "CLS" ? Math.round(event.value * 10_000) / 10_000 : Math.round(event.value);
    serverLog("info", "client.vital", { name: event.name, value, rating: event.rating, route });
    return;
  }
  const { type: _type, ...fields } = event;
  serverLog("error", "client.error", { ...fields, route });
}

/** Writes the browser's report to the server log; returns nothing. */
export const reportClientTelemetry = createServerFn({ method: "POST" })
  .validator(clientReportSchema)
  .handler(async ({ data }) => {
    for (const event of data.events) logReportEvent(event);
  });
