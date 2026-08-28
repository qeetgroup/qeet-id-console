// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { PublicSession } from "@/platform/auth/server-session";
import { sessionStore } from "@/platform/auth/session-store";
import { ApiError } from "@/platform/errors/api-error";

const { clearServerSession, onAuthLost, proxyApiRequest, refreshServerSessionNow } = vi.hoisted(
  () => ({
    clearServerSession: vi.fn(),
    onAuthLost: vi.fn(),
    proxyApiRequest: vi.fn(),
    refreshServerSessionNow: vi.fn(),
  }),
);

vi.mock("@/platform/auth/auth-lost", () => ({ onAuthLost }));
vi.mock("@/platform/api/server-proxy", () => ({
  clearServerSession,
  proxyApiRequest,
  refreshServerSessionNow,
}));

import { api } from "../client";

const AUTHENTICATED_SESSION: PublicSession = {
  isAuthenticated: true,
  expiresAt: "2030-01-01T00:00:00Z",
  sessionId: "session-1",
  userId: "user-1",
  tenantId: "tenant-1",
  version: 1,
  impersonationActor: null,
};

const EMPTY_SESSION: PublicSession = {
  isAuthenticated: false,
  expiresAt: null,
  sessionId: null,
  userId: null,
  tenantId: null,
  version: 0,
  impersonationActor: null,
};

beforeEach(() => {
  proxyApiRequest.mockReset();
  refreshServerSessionNow.mockReset();
  clearServerSession.mockReset();
  clearServerSession.mockResolvedValue({ ok: true });
  onAuthLost.mockReset();
  sessionStore.set(EMPTY_SESSION);
});

describe("api() BFF request", () => {
  it("forwards a correlated request and applies safe session metadata", async () => {
    proxyApiRequest.mockResolvedValue({
      status: 200,
      data: { ok: true },
      session: AUTHENTICATED_SESSION,
      sessionChanged: false,
    });

    const out = await api<{ ok: boolean }>("/v1/thing", {
      query: { page: 2, empty: undefined },
    });

    expect(out).toEqual({ ok: true });
    expect(proxyApiRequest).toHaveBeenCalledWith({
      data: expect.objectContaining({
        path: "/v1/thing",
        method: "GET",
        anonymous: false,
        query: { page: 2 },
        requestId: expect.any(String),
      }),
      signal: undefined,
    });
    expect(sessionStore.getSnapshot()).toEqual(AUTHENTICATED_SESSION);
  });

  it("marks public auth calls anonymous", async () => {
    proxyApiRequest.mockResolvedValue({
      status: 401,
      data: { error: { code: "bad_creds", message: "Invalid credentials" } },
      session: EMPTY_SESSION,
      sessionChanged: false,
    });

    await expect(api("/v1/auth/login", { method: "POST", anonymous: true })).rejects.toMatchObject({
      code: "bad_creds",
    });
    expect(proxyApiRequest.mock.calls[0][0].data.anonymous).toBe(true);
    expect(onAuthLost).not.toHaveBeenCalled();
  });

  it("returns undefined on 204", async () => {
    proxyApiRequest.mockResolvedValue({
      status: 204,
      data: null,
      session: AUTHENTICATED_SESSION,
      sessionChanged: false,
    });
    await expect(api("/v1/thing", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("throws a typed ApiError from the backend envelope", async () => {
    proxyApiRequest.mockResolvedValue({
      status: 409,
      data: { error: { code: "thing.gone", message: "Gone", detail: "d" } },
      session: AUTHENTICATED_SESSION,
      sessionChanged: false,
    });
    await expect(api("/v1/thing")).rejects.toMatchObject({
      status: 409,
      code: "thing.gone",
    });
  });

  it("handles final authenticated 401 as a lost server session", async () => {
    proxyApiRequest.mockResolvedValue({
      status: 401,
      data: { error: { code: "auth.session_expired", message: "Expired" } },
      session: EMPTY_SESSION,
      sessionChanged: true,
    });
    sessionStore.set(AUTHENTICATED_SESSION);

    await expect(api("/v1/thing")).rejects.toBeInstanceOf(ApiError);
    expect(sessionStore.getSnapshot().isAuthenticated).toBe(false);
    expect(onAuthLost).toHaveBeenCalledOnce();
  });

  it("parses with an opt-in schema and fails closed on mismatch", async () => {
    const schema = z.object({ permissions: z.array(z.string()) });
    proxyApiRequest.mockResolvedValueOnce({
      status: 200,
      data: { permissions: ["a", "b"] },
      session: AUTHENTICATED_SESSION,
      sessionChanged: false,
    });
    await expect(api("/v1/perm", { schema })).resolves.toEqual({ permissions: ["a", "b"] });

    proxyApiRequest.mockResolvedValueOnce({
      status: 200,
      data: { permissions: "not-an-array" },
      session: AUTHENTICATED_SESSION,
      sessionChanged: false,
    });
    await expect(api("/v1/perm", { schema })).rejects.toMatchObject({
      code: "client.schema_mismatch",
    });
  });
});
