import type { ServerSessionData } from "@/platform/auth/server-session";

export type BackendTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  session_id: string;
  user_id: string;
  tenant_id?: string;
};

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export function isBackendTokenResponse(value: unknown): value is BackendTokenResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.access_token === "string" &&
    typeof record.refresh_token === "string" &&
    typeof record.expires_at === "string" &&
    typeof record.session_id === "string" &&
    typeof record.user_id === "string"
  );
}

export function isSessionIssuingRequest(path: string, method: string): boolean {
  if (method !== "POST") return false;
  if (/^\/v1\/me\/invites\/[^/]+\/accept$/.test(path)) return true;
  return new Set([
    "/v1/auth/login",
    "/v1/auth/mfa",
    "/v1/auth/signup",
    "/v1/auth/magic-link/consume",
    "/v1/auth/switch-tenant",
    "/v1/invites/accept",
    "/v1/passkeys/login/finish",
    "/v1/signup/passkey/finish",
    "/v1/social/exchange",
    "/v1/tenants",
    "/v1/admin/impersonate",
    "/v1/admin/impersonate/exit",
    "/saml/exchange",
  ]).has(path);
}

export function isSignInRequest(path: string, method: string): boolean {
  return (
    method === "POST" &&
    new Set([
      "/v1/auth/login",
      "/v1/auth/mfa",
      "/v1/auth/magic-link/consume",
      "/v1/passkeys/login/finish",
      "/v1/social/exchange",
      "/saml/exchange",
    ]).has(path)
  );
}

export function stripBackendTokens(value: BackendTokenResponse): Record<string, JsonValue> {
  const { access_token: _accessToken, refresh_token: _refreshToken, ...safe } = value;
  return safe;
}

export function serverSessionData(value: BackendTokenResponse): ServerSessionData {
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresAt: value.expires_at,
    sessionId: value.session_id,
    userId: value.user_id,
    tenantId: value.tenant_id,
    version: 1,
  };
}
