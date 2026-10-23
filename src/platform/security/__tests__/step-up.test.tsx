// @vitest-environment jsdom
// Runs the real api() against a mocked BFF, so the step-up schemas meet the payloads the server
// sends and a drifted one fails closed.
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
// Wraps the real api() so a mismatch the options query swallows can still be seen.
vi.mock("@/platform/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/platform/api/client")>();
  return { ...actual, api: vi.fn(actual.api) };
});
vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: () => true,
  startAuthentication: vi.fn(async () => ({ id: "cred-1", type: "public-key" })),
}));

import { api } from "@/platform/api/client";
import { useStepUpOptions, useStepUpPasskey, useStepUpVerify } from "../step-up";

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

/** Answers each request by its path; an unknown path is a 404. */
function serve(bodies: Record<string, unknown>) {
  proxyApiRequest.mockImplementation(async ({ data }: { data: { path: string } }) => {
    const found = data.path in bodies;
    return {
      status: found ? 200 : 404,
      data: found ? bodies[data.path] : { error: { code: "not_found" } },
      session: SIGNED_OUT,
      sessionChanged: false,
    };
  });
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
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

async function options(allowed: string[] | null = null) {
  const { result } = renderHook(() => useStepUpOptions(true, allowed), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return result.current.data;
}

const EMAIL = {
  id: "6f1c1f9e-0d8b-4f43-9a51-0d2f3c7b9e10",
  channel: "email",
  destination: "a***@example.com",
  verified: true,
  created_at: "2026-10-01T09:30:00Z",
};
const PASSKEY = {
  id: "0b6c8a52-4a3e-4b8e-9d0e-6a1f2b3c4d5e",
  user_id: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  name: "Chrome on macOS",
  transports: ["internal"],
  last_used_at: null,
  created_at: "2026-09-01T10:00:00Z",
};

beforeEach(() => {
  proxyApiRequest.mockReset();
  vi.mocked(api).mockClear();
});
afterEach(cleanup);

describe("useStepUpOptions", () => {
  it("offers every factor the person holds", async () => {
    serve({
      "/v1/mfa/totp": { enrolled: true },
      "/v1/mfa/otp/factors": { items: [EMAIL, { ...EMAIL, id: "unconfirmed", verified: false }] },
      "/v1/passkeys": { items: [PASSKEY], enrollment_allowed: true },
    });
    expect(await options()).toEqual({
      passkey: true,
      authenticator: true,
      recoveryCode: true,
      codeFactors: [{ id: EMAIL.id, channel: "email", destination: "a***@example.com" }],
    });
  });

  it("withholds a factor whose response drifted, failing closed", async () => {
    serve({
      "/v1/mfa/totp": { enrolled: "true" },
      "/v1/mfa/otp/factors": { items: [{ ...EMAIL, channel: "push" }] },
      "/v1/passkeys": { items: [{ name: "Chrome on macOS" }] },
    });
    expect(await options()).toEqual({
      passkey: false,
      authenticator: false,
      recoveryCode: false,
      codeFactors: [],
    });
    const settled = await Promise.allSettled(vi.mocked(api).mock.results.map((r) => r.value));
    expect(settled.map((s) => (s.status === "rejected" ? s.reason.code : s.status))).toEqual([
      MISMATCH.code,
      MISMATCH.code,
      MISMATCH.code,
    ]);
  });
});

describe("useStepUpVerify", () => {
  it("accepts a verified code from the app or an email/SMS factor", async () => {
    serve({ "/v1/mfa/totp/verify": { verified: true }, "/v1/mfa/otp/verify": { verified: true } });
    await expect(mutate(() => useStepUpVerify(), { code: "123456" })).resolves.toEqual({
      verified: true,
    });
    await expect(mutate(() => useStepUpVerify(), { code: "123456", kind: "otp" })).resolves.toEqual(
      { verified: true },
    );
  });

  it("never counts an answer other than verified: true as a step-up", async () => {
    serve({ "/v1/mfa/totp/verify": { verified: false } });
    await expect(mutate(() => useStepUpVerify(), { code: "123456" })).rejects.toMatchObject(
      MISMATCH,
    );
    serve({ "/v1/mfa/otp/verify": {} });
    await expect(
      mutate(() => useStepUpVerify(), { code: "123456", kind: "otp" }),
    ).rejects.toMatchObject(MISMATCH);
  });
});

describe("useStepUpPasskey", () => {
  const challenge = {
    session_id: "c0ffee00-0000-4000-8000-000000000000",
    publicKey: { challenge: "Y2hhbGxlbmdl", rpId: "id.qeet.in", userVerification: "preferred" },
  };

  it("accepts a verified assertion", async () => {
    serve({
      "/v1/mfa/webauthn/challenge": challenge,
      "/v1/mfa/webauthn/verify": { verified: true },
    });
    await expect(mutate(() => useStepUpPasskey(), undefined)).resolves.toEqual({ verified: true });
  });

  it("fails closed when the verify answer drifted", async () => {
    serve({ "/v1/mfa/webauthn/challenge": challenge, "/v1/mfa/webauthn/verify": { ok: true } });
    await expect(mutate(() => useStepUpPasskey(), undefined)).rejects.toMatchObject(MISMATCH);
  });
});
