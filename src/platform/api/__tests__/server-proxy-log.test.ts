import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerSessionData } from "@/platform/auth/server-session";

const store = vi.hoisted(() => ({ data: {} as ServerSessionData, fetch: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    validator() {
      return this;
    },
    handler(callback: unknown) {
      return callback;
    },
  }),
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("http://localhost:3002/"),
  getRequestIP: () => "203.0.113.7",
  getResponse: () => new Response(),
}));
vi.mock("@/platform/auth/server-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/platform/auth/server-session")>();
  return {
    ...actual,
    readServerSession: async () => store.data,
    clearServerSessionCookie: async () => {
      store.data = {};
    },
    openServerSession: async () => ({
      get data() {
        return store.data;
      },
      update: async (patch: ServerSessionData) => {
        store.data = { ...store.data, ...patch };
      },
      clear: async () => {
        store.data = {};
      },
    }),
  };
});
vi.mock("@/platform/telemetry/logger", () => ({ logger: { debug: vi.fn() } }));

import { _setServerLogSinkForTest } from "@/platform/telemetry/server-log";
import {
  _resetRefreshFlightsForTest,
  proxyApiRequest,
  refreshServerSessionNow,
} from "../server-proxy";

const USER = "550e8400-e29b-41d4-a716-446655440000";
const tokens = {
  access_token: "access-secret",
  refresh_token: "refresh-secret",
  expires_at: "2030-01-01T00:00:00Z",
  session_id: "session-a",
  user_id: "user-a",
  tenant_id: "11111111-1111-4111-8111-111111111111",
};
const signedIn = (): ServerSessionData => ({
  accessToken: "old-access",
  refreshToken: "old-refresh",
  userId: "user-a",
  sessionId: "session-a",
  version: 1,
});
const expired = () => Response.json({ error: { code: "auth.session_expired" } }, { status: 401 });
const revoked = () => Response.json({ error: { code: "auth.session_revoked" } }, { status: 401 });

let lines: string[] = [];
const logged = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);

function request(path: string, query: Record<string, string | number> = {}) {
  return proxyApiRequest({
    data: { path, method: "GET", query, anonymous: false, requestId: "req-1" },
  });
}

beforeEach(() => {
  store.data = signedIn();
  store.fetch.mockReset();
  _resetRefreshFlightsForTest();
  vi.stubGlobal("fetch", store.fetch);
  lines = [];
  _setServerLogSinkForTest((line) => lines.push(line));
});
afterEach(() => {
  vi.unstubAllGlobals();
  _setServerLogSinkForTest(null);
});

describe("The BFF's production log", () => {
  it("writes one line per proxied call: the path's template, never its ids, query or tokens", async () => {
    store.fetch.mockResolvedValueOnce(Response.json({ id: USER, email: "jane@acme.io" }));

    await request(`/v1/users/${USER}/security`, { email: "jane@acme.io" });

    expect(logged()).toEqual([
      {
        ts: expect.any(String),
        level: "info",
        event: "api.request",
        requestId: "req-1",
        method: "GET",
        path: "/v1/users/{id}/security",
        status: 200,
        durationMs: expect.any(Number),
        outcome: "ok",
      },
    ]);
    const written = lines.join("\n");
    for (const secret of [USER, "jane", "old-access", "old-refresh"]) {
      expect(written).not.toContain(secret);
    }
  });

  it("logs a renewed session and the request it rescued", async () => {
    store.fetch
      .mockResolvedValueOnce(expired())
      .mockResolvedValueOnce(Response.json(tokens))
      .mockResolvedValueOnce(Response.json({ id: "user-a" }));

    await request("/v1/me");

    expect(logged()).toEqual([
      expect.objectContaining({
        level: "info",
        event: "session.refresh",
        requestId: "req-1",
        trigger: "backend_401",
        outcome: "refreshed",
      }),
      expect.objectContaining({ event: "api.request", status: 200, outcome: "refreshed" }),
    ]);
    expect(lines.join("\n")).not.toContain("secret");
  });

  it("logs a rejected refresh token as the end of the session", async () => {
    store.fetch.mockResolvedValueOnce(expired()).mockResolvedValueOnce(revoked());

    await request("/v1/me");

    expect(logged()).toEqual([
      expect.objectContaining({ level: "warn", event: "session.refresh", outcome: "rejected" }),
      expect.objectContaining({ status: 401, outcome: "refresh_rejected" }),
    ]);
  });

  it("logs an unreachable refresh as the backend being unavailable", async () => {
    store.fetch
      .mockResolvedValueOnce(expired())
      .mockResolvedValueOnce(new Response("", { status: 503 }));

    await request("/v1/me");

    expect(logged()).toEqual([
      expect.objectContaining({ level: "error", event: "session.refresh", outcome: "unavailable" }),
      expect.objectContaining({ level: "error", status: 503, outcome: "backend_unavailable" }),
    ]);
  });

  it("logs a backend that never answered, then lets the error through", async () => {
    store.fetch.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(request("/v1/me")).rejects.toThrow("fetch failed");

    expect(logged()).toEqual([
      expect.objectContaining({ level: "error", status: null, outcome: "backend_unavailable" }),
    ]);
  });

  it("logs a session the backend ended", async () => {
    store.fetch.mockResolvedValueOnce(revoked());

    await request("/v1/me");

    expect(logged()).toEqual([expect.objectContaining({ status: 401, outcome: "session_ended" })]);
  });

  it("logs a refused credential response without the credentials", async () => {
    store.fetch.mockResolvedValueOnce(Response.json(tokens));

    await request("/v1/me");

    expect(logged()).toEqual([
      expect.objectContaining({ level: "error", status: 502, outcome: "unexpected_token" }),
    ]);
    expect(lines.join("\n")).not.toContain("secret");
  });

  it("logs the browser's own refresh with what prompted it", async () => {
    store.fetch.mockResolvedValueOnce(Response.json(tokens));

    await refreshServerSessionNow({ data: { expectedVersion: 1, force: true } });

    expect(logged()).toEqual([
      expect.objectContaining({
        event: "session.refresh",
        trigger: "browser_forced",
        outcome: "refreshed",
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      }),
    ]);
  });
});
