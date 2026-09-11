import { describe, expect, it } from "vitest";

import {
  isBackendTokenResponse,
  isSessionIssuingRequest,
  serverSessionData,
  stripBackendTokens,
} from "../session-response";

const tokenResponse = {
  access_token: "access-secret",
  refresh_token: "refresh-secret",
  token_type: "Bearer",
  expires_at: "2030-01-01T00:00:00Z",
  session_id: "session-1",
  user_id: "user-1",
  tenant_id: "tenant-1",
};

describe("session response policy", () => {
  it("adopts token pairs only from explicit authentication transitions", () => {
    expect(isSessionIssuingRequest("/v1/auth/login", "POST")).toBe(true);
    expect(isSessionIssuingRequest("/v1/auth/switch-tenant", "POST")).toBe(true);
    expect(isSessionIssuingRequest("/v1/passkeys/login/finish", "POST")).toBe(true);
    expect(isSessionIssuingRequest("/v1/signup/passkey/finish", "POST")).toBe(true);
    expect(isSessionIssuingRequest("/v1/me/invites/invite-1/accept", "POST")).toBe(true);
    expect(isSessionIssuingRequest("/v1/tenants", "POST")).toBe(true);

    expect(isSessionIssuingRequest("/v1/oauth/token-code", "POST")).toBe(false);
    expect(isSessionIssuingRequest("/v1/credentials/issue", "POST")).toBe(false);
    expect(isSessionIssuingRequest("/v1/passkeys/signup/finish", "POST")).toBe(false);
    expect(isSessionIssuingRequest("/v1/signup/passkey/begin", "POST")).toBe(false);
    expect(isSessionIssuingRequest("/v1/signup/passkey/finish", "GET")).toBe(false);
    expect(isSessionIssuingRequest("/v1/passkeys/login/finish", "GET")).toBe(false);
    expect(isSessionIssuingRequest("/v1/auth/login", "GET")).toBe(false);
  });

  it("requires a complete refreshable token pair", () => {
    expect(isBackendTokenResponse(tokenResponse)).toBe(true);
    expect(isBackendTokenResponse({ ...tokenResponse, refresh_token: undefined })).toBe(false);
    expect(isBackendTokenResponse({ access_token: "only-access" })).toBe(false);
  });

  it("strips both credentials before returning data to the browser", () => {
    const safe = stripBackendTokens(tokenResponse);
    expect(safe).not.toHaveProperty("access_token");
    expect(safe).not.toHaveProperty("refresh_token");
    expect(safe).toMatchObject({ session_id: "session-1", user_id: "user-1" });
  });

  it("maps credentials only into server session data", () => {
    expect(serverSessionData(tokenResponse)).toEqual({
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      expiresAt: "2030-01-01T00:00:00Z",
      sessionId: "session-1",
      userId: "user-1",
      tenantId: "tenant-1",
      version: 1,
    });
  });
});
