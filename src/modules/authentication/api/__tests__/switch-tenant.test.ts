import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicSession } from "@/platform/auth/server-session";

const { proxyApiRequest } = vi.hoisted(() => ({ proxyApiRequest: vi.fn() }));

vi.mock("@/platform/auth/auth-lost", () => ({ onAuthLost: vi.fn() }));
vi.mock("@/platform/api/server-proxy", () => ({
  clearServerSession: vi.fn(),
  proxyApiRequest,
  refreshServerSessionNow: vi.fn(),
}));

import { switchToTenant } from "../flows";

const SWITCHED: PublicSession = {
  isAuthenticated: true,
  expiresAt: "2026-10-23T09:15:00Z",
  sessionId: "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d",
  userId: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  tenantId: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
  version: 1,
  impersonationActor: null,
};

function respond(data: unknown) {
  proxyApiRequest.mockResolvedValueOnce({
    status: 200,
    data,
    session: SWITCHED,
    sessionChanged: true,
  });
}

beforeEach(() => proxyApiRequest.mockReset());

describe("switchToTenant", () => {
  it("accepts the session metadata the BFF passes on once it has kept the tokens", async () => {
    respond({
      token_type: "Bearer",
      expires_at: "2026-10-23T09:15:00Z",
      session_id: SWITCHED.sessionId,
      user_id: SWITCHED.userId,
      tenant_id: SWITCHED.tenantId,
    });
    await expect(switchToTenant(SWITCHED.tenantId as string)).resolves.toBeUndefined();
    expect(proxyApiRequest.mock.calls[0]?.[0].data).toMatchObject({
      path: "/v1/auth/switch-tenant",
      method: "POST",
      body: { tenant_id: SWITCHED.tenantId },
    });
  });

  it("fails closed when the response names no organization", async () => {
    respond({ session_id: SWITCHED.sessionId, user_id: SWITCHED.userId });
    await expect(switchToTenant(SWITCHED.tenantId as string)).rejects.toMatchObject({
      code: "client.schema_mismatch",
    });
  });
});
