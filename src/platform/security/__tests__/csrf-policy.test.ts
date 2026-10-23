import { createCsrfMiddleware } from "@tanstack/react-start";
import { describe, expect, it } from "vitest";

import { csrfPolicy } from "../csrf-policy";

// The real middleware: outside the Start compiler, createCsrfMiddleware returns the server side.
const middleware = createCsrfMiddleware(csrfPolicy) as unknown as {
  options: { server: (ctx: unknown) => Promise<unknown> };
};

const ORIGIN = "https://console.id.qeet.in";
const NEXT = Symbol("next");

async function decide(
  handlerType: "serverFn" | "router",
  method: string,
  headers: Record<string, string>,
): Promise<"allowed" | "refused"> {
  const request = new Request(`${ORIGIN}/_serverFn/proxy`, { method, headers });
  const result = await middleware.options.server({ request, handlerType, next: () => NEXT });
  if (result === NEXT) return "allowed";
  expect((result as Response).status).toBe(403);
  return "refused";
}

describe("CSRF policy", () => {
  it("allows a same-origin server function call", async () => {
    expect(await decide("serverFn", "POST", { "Sec-Fetch-Site": "same-origin" })).toBe("allowed");
  });

  it("refuses a cross-site server function call", async () => {
    expect(await decide("serverFn", "POST", { "Sec-Fetch-Site": "cross-site" })).toBe("refused");
  });

  it("refuses a server function call from another origin when Sec-Fetch-Site is absent", async () => {
    expect(await decide("serverFn", "POST", { Origin: "https://evil.example" })).toBe("refused");
  });

  it("refuses a server function call that carries no origin signal at all", async () => {
    expect(await decide("serverFn", "POST", {})).toBe("refused");
  });

  it("validates GET server functions too (they read the session)", async () => {
    expect(await decide("serverFn", "GET", { "Sec-Fetch-Site": "cross-site" })).toBe("refused");
  });

  it("refuses a cross-site unsafe request to a server route", async () => {
    expect(await decide("router", "POST", { Origin: "https://evil.example" })).toBe("refused");
  });

  it("lets a cross-site GET to a server route through (pages, /healthz, streams)", async () => {
    expect(await decide("router", "GET", { "Sec-Fetch-Site": "cross-site" })).toBe("allowed");
  });
});
