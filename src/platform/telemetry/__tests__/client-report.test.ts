import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Outside the Start compiler: the server function validates with its schema, then runs the handler.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let schema: { parse: (input: unknown) => unknown } | undefined;
    return {
      validator(next: typeof schema) {
        schema = next;
        return this;
      },
      handler(callback: (ctx: { data: unknown }) => unknown) {
        return async ({ data }: { data: unknown }) =>
          callback({ data: schema ? schema.parse(data) : data });
      },
    };
  },
}));

import { _setServerLogSinkForTest } from "../server-log";
import { REPORT_LIMITS, reportClientTelemetry } from "../client-report";

const JWT = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ1c2VyLWEifQ.c2lnbmF0dXJlLWJ5dGVz";
const REFRESH = "kq3vR8nZ0x_Yb7-LmP2tQ9sW4eA1cD6fH5jK8uN0oV3";

let lines: string[] = [];
beforeEach(() => {
  lines = [];
  _setServerLogSinkForTest((line) => lines.push(line));
});
afterEach(() => _setServerLogSinkForTest(null));

const vital = { type: "vital", name: "LCP", value: 1234.56, rating: "good", route: "/users" };
const error = {
  type: "error",
  source: "window",
  name: "TypeError",
  message: "Cannot read properties of undefined (reading 'id')",
  stack:
    "TypeError: Cannot read properties of undefined\n    at render (/assets/user-page-C4iFXKrr.js:1:20)",
  code: "unknown",
  route: "/users/$userId",
};

// The server function's input as the browser would send it, unchecked so bad input can be tried.
function report(events: unknown[], extra: Record<string, unknown> = {}) {
  const call = reportClientTelemetry as unknown as (opts: { data: unknown }) => Promise<unknown>;
  return call({ data: { events, ...extra } });
}

const logged = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);

describe("the browser report endpoint", () => {
  it("logs one line per event, under its route's template", async () => {
    await report([vital, error, { ...vital, name: "CLS", value: 0.123456, rating: "poor" }]);

    expect(logged()).toEqual([
      expect.objectContaining({
        level: "info",
        event: "client.vital",
        name: "LCP",
        value: 1235,
        rating: "good",
        route: "/users",
      }),
      expect.objectContaining({
        level: "error",
        event: "client.error",
        source: "window",
        name: "TypeError",
        code: "unknown",
        route: "/users/$userId",
      }),
      expect.objectContaining({ event: "client.vital", name: "CLS", value: 0.1235 }),
    ]);
    expect(logged()[1]).not.toHaveProperty("type");
  });

  it("templates a concrete path the browser sent by mistake", async () => {
    await report([{ ...vital, route: "/users/550e8400-e29b-41d4-a716-446655440000" }]);
    expect(logged()[0]?.route).toBe("/users/{id}");
  });

  it.each([
    ["a field outside the allowlist", [{ ...error, email: "jane@acme.io" }], {}],
    ["a token field", [{ ...vital, token: REFRESH }], {}],
    ["an unknown field beside the events", [vital], { url: "https://console.test/users?x=1" }],
    ["an unknown event type", [{ ...vital, type: "pageview" }], {}],
    ["an unknown error source", [{ ...error, source: "console" }], {}],
  ])("rejects %s", async (_case, events, extra) => {
    await expect(report(events, extra)).rejects.toThrow();
    expect(lines).toEqual([]);
  });

  it.each([
    ["an overlong message", [{ ...error, message: "x".repeat(REPORT_LIMITS.message + 1) }]],
    ["an overlong stack", [{ ...error, stack: "x".repeat(REPORT_LIMITS.stack + 1) }]],
    ["an overlong route", [{ ...vital, route: `/${"a".repeat(REPORT_LIMITS.route)}` }]],
    ["a route with a query string", [{ ...vital, route: "/users?email=jane@acme.io" }]],
    ["a full URL as the route", [{ ...vital, route: "https://console.test/users" }]],
    ["an out-of-range value", [{ ...vital, value: -1 }]],
    ["too many events", Array.from({ length: REPORT_LIMITS.events + 1 }, () => vital)],
    ["an empty batch", []],
  ])("rejects %s", async (_case, events) => {
    await expect(report(events)).rejects.toThrow();
    expect(lines).toEqual([]);
  });

  it("never logs a token-shaped value", async () => {
    await report([
      {
        ...error,
        message: `refresh failed for Bearer ${REFRESH} with ${JWT}`,
        stack: `Error: at /reset-password?token=${REFRESH}\n    at x (/assets/a.js:1:1)`,
        requestId: JWT,
      },
    ]);

    const written = lines.join("\n");
    expect(lines).toHaveLength(1);
    expect(written).not.toContain(REFRESH);
    expect(written).not.toContain(JWT);
    expect(written).not.toContain("eyJ");
  });
});
