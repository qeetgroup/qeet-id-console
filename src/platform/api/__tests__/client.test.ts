// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { tokenStore } from "@/platform/auth/token-store";
import { ApiError } from "@/platform/errors/api-error";
import { api } from "../client";

// Route the global fetch mock by URL so the /auth/refresh call and the business
// call can return different responses.
type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;
let handler: Handler;
const fetchSpy = vi.fn((input: URL | RequestInfo, init?: RequestInit) =>
  Promise.resolve(handler(String(input), init ?? {})),
);

function json(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  tokenStore.set("access-1");
  tokenStore.setRefresh("refresh-1");
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api() request", () => {
  it("attaches Bearer + X-Request-Id and returns parsed JSON", async () => {
    handler = () => json({ ok: true });
    const out = await api<{ ok: boolean }>("/v1/thing");
    expect(out).toEqual({ ok: true });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer access-1");
    expect(headers["X-Request-Id"]).toBeTruthy();
  });

  it("omits Authorization for anonymous calls and does not retry their 401s", async () => {
    handler = () => json({ error: { code: "bad_creds", message: "no" } }, 401);
    await expect(api("/v1/auth/login", { anonymous: true })).rejects.toBeInstanceOf(ApiError);
    // one call only — no refresh attempt for anonymous
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("returns undefined on 204", async () => {
    handler = () => json(null, 204);
    await expect(api("/v1/thing", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("throws a typed ApiError from the error envelope", async () => {
    handler = () => json({ error: { code: "thing.gone", message: "Gone", detail: "d" } }, 409);
    await expect(api("/v1/thing")).rejects.toMatchObject({
      status: 409,
      code: "thing.gone",
    });
  });

  it("on 401 refreshes once and replays with the new token", async () => {
    let calls = 0;
    handler = (url) => {
      if (url.includes("/auth/refresh")) {
        return json({ access_token: "access-2", refresh_token: "refresh-2" });
      }
      calls += 1;
      return calls === 1
        ? json({ error: { code: "expired", message: "x" } }, 401)
        : json({ ok: 1 });
    };
    const out = await api<{ ok: number }>("/v1/thing");
    expect(out).toEqual({ ok: 1 });
    expect(tokenStore.get()).toBe("access-2");
  });

  it("clears the session and does not replay when refresh fails", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { pathname: "/thing", assign },
      writable: true,
    });
    handler = (url) =>
      url.includes("/auth/refresh")
        ? json({}, 401)
        : json({ error: { code: "e", message: "x" } }, 401);
    await expect(api("/v1/thing")).rejects.toBeInstanceOf(ApiError);
    expect(tokenStore.get()).toBeNull();
    expect(assign).toHaveBeenCalledWith("/sign-in");
  });

  it("single-flights concurrent 401s into ONE refresh", async () => {
    let refreshCalls = 0;
    const seen: Record<string, number> = {};
    handler = (url) => {
      if (url.includes("/auth/refresh")) {
        refreshCalls += 1;
        return json({ access_token: "access-2", refresh_token: "refresh-2" });
      }
      seen[url] = (seen[url] ?? 0) + 1;
      return seen[url] === 1 ? json({ error: { code: "e", message: "x" } }, 401) : json({ ok: 1 });
    };
    await Promise.all([api("/v1/a"), api("/v1/b"), api("/v1/c")]);
    expect(refreshCalls).toBe(1);
  });

  it("parses with an opt-in schema and fails closed on mismatch", async () => {
    const schema = z.object({ permissions: z.array(z.string()) });
    handler = () => json({ permissions: ["a", "b"] });
    await expect(api("/v1/perm", { schema })).resolves.toEqual({ permissions: ["a", "b"] });

    handler = () => json({ permissions: "not-an-array" });
    await expect(api("/v1/perm", { schema })).rejects.toMatchObject({
      code: "client.schema_mismatch",
    });
  });
});
