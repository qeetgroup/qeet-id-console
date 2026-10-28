// @vitest-environment jsdom
// Runs the real api() against a mocked BFF, so each schema meets the payload the server sends and
// a drifted one fails closed. Payloads follow the qeet-id-server response structs.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicSession } from "@/platform/auth/server-session";

const { proxyApiRequest } = vi.hoisted(() => ({ proxyApiRequest: vi.fn() }));

vi.mock("@/platform/auth/auth-lost", () => ({ onAuthLost: vi.fn() }));
vi.mock("@/platform/api/server-proxy", () => ({
  clearServerSession: vi.fn(),
  proxyApiRequest,
  refreshServerSessionNow: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-a" }));

import {
  confirmTotpEnrollment,
  startTotpEnrollment,
  useOtpFactors,
  useRegenerateRecoveryCodes,
  useTotpStatus,
} from "../mfa";
import { startMfaEnrollment } from "../mfa-sign-in";
import { listPasskeys, usePasskeys } from "../passkeys";
import { listSessions, useSessions } from "../sessions";
import { createOidcClient, rotateOidcClientSecret, useCreateOidcClient } from "../oidc-clients";
import { useRotateScimToken } from "../scim-actions";

const SIGNED_OUT: PublicSession = {
  isAuthenticated: false,
  expiresAt: null,
  sessionId: null,
  userId: null,
  tenantId: null,
  version: 0,
  impersonationActor: null,
};

const MISMATCH = { code: "client.schema_mismatch" };

/** Answers the next request with this 2xx body. */
function respond(data: unknown, status = 200) {
  proxyApiRequest.mockResolvedValueOnce({
    status,
    data,
    session: SIGNED_OUT,
    sessionChanged: false,
  });
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Runs a query hook until it settles and returns its data or error. */
async function settle<T>(hook: () => { isPending: boolean; data?: T; error: unknown }) {
  const { result } = renderHook(hook, { wrapper });
  await waitFor(() => expect(result.current.isPending).toBe(false));
  return { data: result.current.data, error: result.current.error };
}

/** Runs one mutation and returns its promise, settled. */
async function mutate<V, T>(hook: () => { mutateAsync: (v: V) => Promise<T> }, variables: V) {
  const { result } = renderHook(hook, { wrapper });
  let outcome!: Promise<T>;
  await act(async () => {
    outcome = result.current.mutateAsync(variables);
    await outcome.catch(() => undefined);
  });
  return outcome;
}

const PROVISIONING_URL =
  "otpauth://totp/Qeet%20ID:ada%40example.com" +
  "?algorithm=SHA1&digits=6&issuer=Qeet+ID&period=30&secret=JBSWY3DPEHPK3PXP";
const RECOVERY_CODES = {
  recovery_codes: ["0123456789", "1234567890", "2345678901"],
  warning: "store these once; they will not be shown again",
};

beforeEach(() => proxyApiRequest.mockReset());
afterEach(cleanup);

describe("MFA", () => {
  it("reads the TOTP status, and fails closed when enrolled isn't a boolean", async () => {
    respond({ enrolled: true });
    expect((await settle(() => useTotpStatus())).data).toEqual({ enrolled: true });

    respond({ enrolled: "yes" });
    expect((await settle(() => useTotpStatus())).error).toMatchObject(MISMATCH);
  });

  it("starts an authenticator app, and refuses a setup without an otpauth URI", async () => {
    respond({ secret: "JBSWY3DPEHPK3PXP", provisioning_url: PROVISIONING_URL, replacing: false });
    await expect(startTotpEnrollment()).resolves.toEqual({
      secret: "JBSWY3DPEHPK3PXP",
      provisioning_url: PROVISIONING_URL,
      replacing: false,
    });
    expect(proxyApiRequest.mock.calls[0]?.[0].data).toMatchObject({
      path: "/v1/mfa/totp/enroll/start",
      method: "POST",
    });

    respond({ secret: "JBSWY3DPEHPK3PXP", provisioning_url: "https://example.com/qr" });
    await expect(startTotpEnrollment()).rejects.toMatchObject(MISMATCH);
    respond({ secret: "", provisioning_url: PROVISIONING_URL, replacing: true });
    await expect(startTotpEnrollment()).rejects.toMatchObject(MISMATCH);
  });

  it("confirms the app and returns its recovery codes, and fails closed without them", async () => {
    respond(RECOVERY_CODES);
    await expect(confirmTotpEnrollment("123456")).resolves.toEqual(RECOVERY_CODES);
    expect(proxyApiRequest.mock.calls[0]?.[0].data).toMatchObject({
      path: "/v1/mfa/totp/enroll/confirm",
      body: { code: "123456" },
    });

    respond({ codes: RECOVERY_CODES.recovery_codes });
    await expect(confirmTotpEnrollment("123456")).rejects.toMatchObject(MISMATCH);
  });

  it("regenerates recovery codes, and fails closed on a code that isn't a string", async () => {
    respond(RECOVERY_CODES);
    await expect(mutate(() => useRegenerateRecoveryCodes(), undefined)).resolves.toEqual(
      RECOVERY_CODES,
    );

    respond({ recovery_codes: [123456789], warning: RECOVERY_CODES.warning });
    await expect(mutate(() => useRegenerateRecoveryCodes(), undefined)).rejects.toMatchObject(
      MISMATCH,
    );
  });

  it("lists OTP factors, and fails closed on a channel it doesn't know", async () => {
    const factor = {
      id: "6f1c1f9e-0d8b-4f43-9a51-0d2f3c7b9e10",
      channel: "sms",
      destination: "+91******3210",
      verified: true,
      created_at: "2026-10-01T09:30:00Z",
    };
    respond({ items: [factor] });
    expect((await settle(() => useOtpFactors())).data).toEqual({ items: [factor] });

    respond({ items: [{ ...factor, channel: "whatsapp" }] });
    expect((await settle(() => useOtpFactors())).error).toMatchObject(MISMATCH);
  });

  it("starts a sign-in's enrolment app, and refuses one without an otpauth URI", async () => {
    respond({ secret: "JBSWY3DPEHPK3PXP", provisioning_url: PROVISIONING_URL });
    await expect(startMfaEnrollment("mfa-token")).resolves.toEqual({
      secret: "JBSWY3DPEHPK3PXP",
      provisioning_url: PROVISIONING_URL,
    });

    respond({ secret: "JBSWY3DPEHPK3PXP" });
    await expect(startMfaEnrollment("mfa-token")).rejects.toMatchObject(MISMATCH);
  });
});

describe("passkeys", () => {
  const named = {
    id: "0b6c8a52-4a3e-4b8e-9d0e-6a1f2b3c4d5e",
    user_id: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
    name: "Chrome on macOS",
    transports: ["internal", "hybrid"],
    last_used_at: "2026-10-20T08:00:00Z",
    created_at: "2026-09-01T10:00:00Z",
  };
  // Enrolled before passkeys were named, never used, with no transports recorded.
  const unnamed = { ...named, id: "1c7d9b63", name: null, transports: null, last_used_at: null };

  it("lists the passkeys and whether one may be added", async () => {
    respond({ items: [named, unnamed], enrollment_allowed: false });
    await expect(listPasskeys()).resolves.toEqual({
      items: [named, unnamed],
      enrollment_allowed: false,
    });
  });

  it("fails closed when the list isn't one", async () => {
    respond({ passkeys: [named], enrollment_allowed: true });
    expect((await settle(() => usePasskeys())).error).toMatchObject(MISMATCH);
  });
});

describe("sessions", () => {
  const session = {
    id: "5d2e1f0a-9b8c-4d7e-a6f5-e4d3c2b1a090",
    user_id: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
    tenant_id: "00000000-0000-0000-0000-000000000000",
    ip: "203.0.113.7",
    user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0 Safari/537.36",
    created_at: "2026-10-22T09:00:00Z",
    last_seen_at: "2026-10-23T08:15:00Z",
    revoked_at: null,
    expires_at: "2026-11-21T09:00:00Z",
    idle_expires_at: "2026-10-30T08:15:00Z",
    status: "active",
    device: "Chrome on macOS",
    device_kind: "desktop",
    current: true,
  };

  it("lists the caller's sessions, page fields aside", async () => {
    respond({ items: [session], has_more: false, total: 1 });
    expect((await settle(() => useSessions())).data).toEqual({ items: [session] });
  });

  it("fails closed on a status the console can't place", async () => {
    respond({ items: [{ ...session, status: "superseded" }], has_more: false, total: 1 });
    await expect(listSessions()).rejects.toMatchObject(MISMATCH);
  });
});

describe("OIDC client secrets", () => {
  const client = {
    id: "3e4f5a6b-7c8d-4e9f-a0b1-c2d3e4f5a6b7",
    tenant_id: "tenant-a",
    client_id: "qci_8c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
    type: "confidential",
    name: "Billing portal",
    redirect_uris: ["https://billing.example.com/callback"],
    post_logout_uris: [],
    grant_types: ["authorization_code", "refresh_token"],
    scopes: ["openid", "profile", "email"],
    created_at: "2026-10-23T09:00:00Z",
    pkce_exempt_until: null,
    backchannel_logout_uri: "",
    frontchannel_logout_uri: "",
  };
  const { backchannel_logout_uri: _b, frontchannel_logout_uri: _f, ...readClient } = client;

  it("registers a confidential client with its one-time secret", async () => {
    respond({ client, client_secret: "s3cr3t-url-token", warning: "secret shown once" }, 201);
    await expect(
      mutate(() => useCreateOidcClient(), { name: "Billing portal", type: "confidential" }),
    ).resolves.toEqual({
      client: readClient,
      client_secret: "s3cr3t-url-token",
      warning: "secret shown once",
    });
    expect(proxyApiRequest.mock.calls[0]?.[0].data).toMatchObject({
      path: "/v1/oidc/clients",
      body: { tenant_id: "tenant-a", name: "Billing portal", type: "confidential" },
    });
  });

  it("registers a public client, which has no secret", async () => {
    respond({ client: { ...client, type: "public" } }, 201);
    await expect(
      createOidcClient("tenant-a", { name: "SPA", type: "public" }),
    ).resolves.toMatchObject({ client: { type: "public" } });
  });

  it("fails closed when a confidential client comes back without its secret", async () => {
    respond({ client }, 201);
    await expect(
      createOidcClient("tenant-a", { name: "Billing portal", type: "confidential" }),
    ).rejects.toMatchObject(MISMATCH);
    respond({ client: { ...client, type: "machine" }, client_secret: "s3cr3t" }, 201);
    await expect(
      createOidcClient("tenant-a", { name: "Billing portal", type: "confidential" }),
    ).rejects.toMatchObject(MISMATCH);
  });

  it("rotates a secret, and fails closed on an empty one", async () => {
    respond({ client_secret: "n3w-s3cr3t", warning: "secret shown once" });
    await expect(rotateOidcClientSecret("tenant-a", client.id)).resolves.toEqual({
      client_secret: "n3w-s3cr3t",
      warning: "secret shown once",
    });
    expect(proxyApiRequest.mock.calls[0]?.[0].data.path).toBe(
      `/v1/tenants/tenant-a/oidc/clients/${client.id}/rotate-secret`,
    );

    respond({ client_secret: "", warning: "secret shown once" });
    await expect(rotateOidcClientSecret("tenant-a", client.id)).rejects.toMatchObject(MISMATCH);
  });
});

describe("SCIM token", () => {
  const config = {
    token_set: true,
    token_prefix: "qscim_ab12",
    created_at: "2026-10-23T09:00:00Z",
    last_used_at: null,
    provisioned_count: 0,
  };

  it("issues a token with the new configuration", async () => {
    respond({ token: "qscim_ab12cd34ef56", config }, 201);
    await expect(mutate(() => useRotateScimToken(), undefined)).resolves.toEqual({
      token: "qscim_ab12cd34ef56",
      config,
    });
  });

  it("fails closed without the token", async () => {
    respond({ config }, 201);
    await expect(mutate(() => useRotateScimToken(), undefined)).rejects.toMatchObject(MISMATCH);
  });
});
