// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const vitals = vi.hoisted(() => ({ callbacks: [] as ((metric: unknown) => void)[] }));
vi.mock("web-vitals", () => {
  const observe = (callback: (metric: unknown) => void) => vitals.callbacks.push(callback);
  return { onCLS: observe, onFCP: observe, onINP: observe, onLCP: observe, onTTFB: observe };
});
// The report server function, as the browser calls it.
const transport = vi.hoisted(() => ({
  calls: [] as { data: { events: unknown[] }; fetch?: unknown }[],
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    validator() {
      return this;
    },
    handler() {
      return async (opts: (typeof transport.calls)[number]) => {
        transport.calls.push(opts);
      };
    },
  }),
}));

import { ApiError } from "@/platform/errors/api-error";
import { captureError } from "../errors";
import {
  type ClientReporter,
  createClientReporter,
  startClientTelemetry,
} from "../client-reporter";
import type { ClientReportEvent } from "../client-report";

let sent: ClientReportEvent[][] = [];
const send = vi.fn(async (events: ClientReportEvent[]) => {
  sent.push(events);
});
let route: () => string | undefined = () => "/users/$userId";

function reporter(): ClientReporter {
  return createClientReporter({ send, route: () => route() });
}

const reported = () => sent.flat();

beforeEach(() => {
  sent = [];
  send.mockClear();
  route = () => "/users/$userId";
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the browser error reporter", () => {
  it("reports a message once, however often it is thrown", () => {
    const r = reporter();
    for (let i = 0; i < 3; i++) r.error(new Error("render failed"), "window");
    r.error("render failed", "unhandled-rejection");
    r.flush();

    expect(reported()).toHaveLength(1);
    expect(reported()[0]).toMatchObject({
      type: "error",
      source: "window",
      message: "render failed",
    });
  });

  it("stops after ten distinct errors a page load", () => {
    const r = reporter();
    for (let i = 0; i < 15; i++) r.error(new Error(`failure ${i}`), "window");
    r.flush();
    for (let i = 15; i < 20; i++) r.error(new Error(`failure ${i}`), "window");
    r.flush();

    expect(reported()).toHaveLength(10);
  });

  it("names the route by its template, never the URL", () => {
    const r = reporter();
    r.error(new Error("a"), "window");
    route = () => "/users/550e8400-e29b-41d4-a716-446655440000";
    r.error(new Error("b"), "window");
    route = () => "/users?email=jane@acme.io";
    r.error(new Error("c"), "window");
    route = () => {
      throw new Error("router gone");
    };
    r.error(new Error("d"), "window");
    r.flush();

    expect(reported().map((event) => event.route)).toEqual([
      "/users/$userId",
      "/users/{id}",
      "/users",
      undefined,
    ]);
    expect(JSON.stringify(reported())).not.toContain("jane");
  });

  it("reports an API error by its code, never the backend's message", () => {
    const r = reporter();
    r.error(
      new ApiError(500, "internal", "pq: relation tenant_secrets", undefined, false, undefined, {
        requestId: "req-1",
      }),
      "error-boundary",
    );
    r.flush();

    expect(reported()[0]).toMatchObject({
      message: "internal",
      code: "internal",
      status: 500,
      requestId: "req-1",
    });
    expect(JSON.stringify(reported())).not.toContain("tenant_secrets");
  });

  it("redacts, then cuts the message and stack to the server's bounds", () => {
    const r = reporter();
    const error = new Error(`jane@acme.io ${"x".repeat(1_000)}`);
    error.stack = `Error: at /reset-password?token=abc\n${"    at frame (/assets/a.js:1:1)\n".repeat(200)}`;
    r.error(error, "window");
    r.flush();

    const [event] = reported();
    expect(event?.type).toBe("error");
    if (event?.type !== "error") return;
    expect(event.message.length).toBeLessThanOrEqual(500);
    expect(event.message.startsWith("[redacted-email]")).toBe(true);
    expect(event.stack?.length).toBeLessThanOrEqual(2000);
    expect(event.stack).not.toContain("token=abc");
  });

  it("gathers a burst of errors into one request after a short delay", () => {
    vi.useFakeTimers();
    const r = reporter();
    r.error(new Error("a"), "window");
    r.error(new Error("b"), "window");
    expect(send).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2_000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(sent[0]).toHaveLength(2);
  });

  it("never throws into the app", () => {
    const r = createClientReporter({
      send: () => {
        throw new Error("offline");
      },
      route: () => "/",
    });
    const hostile = {
      toString() {
        throw new Error("no");
      },
    };
    expect(() => r.error(hostile, "unhandled-rejection")).not.toThrow();
    expect(() => r.error(new Error("x"), "window")).not.toThrow();
    expect(() => r.flush()).not.toThrow();

    const rejecting = createClientReporter({ send: () => Promise.reject(new Error("503")), route });
    rejecting.error(new Error("y"), "window");
    expect(() => rejecting.flush()).not.toThrow();
  });
});

describe("the Web Vitals reporter", () => {
  const lcp = { id: "v6-1-LCP", name: "LCP", value: 2400, rating: "good" } as const;
  const cls = { id: "v6-1-CLS", name: "CLS", value: 0.05, rating: "good" } as const;

  it("sends each metric once per page view, at its latest value", () => {
    const r = reporter();
    r.vital(lcp);
    r.vital(cls);
    r.vital({ ...cls, value: 0.2, rating: "needs-improvement" });
    expect(send).not.toHaveBeenCalled();
    r.flush();
    r.vital({ ...cls, value: 0.4, rating: "poor" });
    r.flush();

    expect(reported()).toEqual([
      { type: "vital", name: "LCP", value: 2400, rating: "good", route: "/users/$userId" },
      {
        type: "vital",
        name: "CLS",
        value: 0.2,
        rating: "needs-improvement",
        route: "/users/$userId",
      },
    ]);
  });

  it("splits a large flush into batches the server accepts", () => {
    const r = reporter();
    for (let i = 0; i < 10; i++) r.error(new Error(`e${i}`), "window");
    for (let i = 0; i < 15; i++) r.vital({ ...lcp, id: `lcp-${i}` });
    r.flush();

    expect(sent.map((batch) => batch.length)).toEqual([20, 5]);
  });
});

describe("startClientTelemetry", () => {
  // captureError also writes to the DEV console.
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
  afterEach(() => vi.restoreAllMocks());

  it("does nothing outside a production build", () => {
    startClientTelemetry(() => "/");
    captureError(new Error("dev only"), { source: "sensitive-action" });
    window.dispatchEvent(new Event("pagehide"));
    expect(transport.calls).toEqual([]);
  });

  it("reports uncaught errors, caught ones and Web Vitals when the page is hidden", async () => {
    vi.stubEnv("PROD", true);
    startClientTelemetry(() => "/groups/$groupId");

    window.dispatchEvent(new ErrorEvent("error", { error: new TypeError("x is undefined") }));
    window.dispatchEvent(
      Object.assign(new Event("unhandledrejection"), { reason: "chunk failed" }),
    );
    captureError(new Error("revoke failed"), { source: "sensitive-action" });
    for (const callback of vitals.callbacks)
      callback({ id: "v6-1-TTFB", name: "TTFB", value: 80, rating: "good" });

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(vitals.callbacks).toHaveLength(5);
    expect(transport.calls).toHaveLength(1);
    const events = transport.calls[0]?.data.events as ClientReportEvent[];
    expect(events).toEqual([
      expect.objectContaining({ source: "window", name: "TypeError", message: "x is undefined" }),
      expect.objectContaining({ source: "unhandled-rejection", message: "chunk failed" }),
      expect.objectContaining({ source: "sensitive-action", message: "revoke failed" }),
      { type: "vital", name: "TTFB", value: 80, rating: "good", route: "/groups/$groupId" },
    ]);
    expect(events.every((event) => event.route === "/groups/$groupId")).toBe(true);

    // The report is sent with keepalive, so it survives the page closing.
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const customFetch = transport.calls[0]?.fetch as (url: string, init: RequestInit) => unknown;
    await customFetch("/_serverFn/report", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledWith("/_serverFn/report", {
      method: "POST",
      keepalive: true,
    });
  });
});
