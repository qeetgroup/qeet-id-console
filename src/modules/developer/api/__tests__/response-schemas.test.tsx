// @vitest-environment jsdom
// Runs the real api() against a mocked BFF, so each schema meets the payload the server sends and
// a drifted one fails closed. Payloads follow the qeet-id-server response structs.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
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

import { useCreateAgent } from "../agents";
import { createApiKey } from "../api-key-actions";
import { listApiKeys } from "../api-keys";
import { useIssueCredential } from "../credentials";
import { useRevealSecret } from "../secrets";
import { createServicePrincipal } from "../service-principal-actions";

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
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
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

const SCOPES = ["user.read", "group.read"];

beforeEach(() => proxyApiRequest.mockReset());
afterEach(cleanup);

describe("tenant secrets", () => {
  it("reveals a value, and fails closed when it isn't a string", async () => {
    respond({ value: "postgres://app:pw@db.internal/app" });
    await expect(mutate(() => useRevealSecret(), "secret-1")).resolves.toEqual({
      value: "postgres://app:pw@db.internal/app",
    });
    expect(proxyApiRequest.mock.calls[0]?.[0].data).toMatchObject({
      path: "/v1/tenants/tenant-a/secrets/secret-1/reveal",
      method: "POST",
    });

    respond({ value: null });
    await expect(mutate(() => useRevealSecret(), "secret-1")).rejects.toMatchObject(MISMATCH);
  });
});

describe("verifiable credentials", () => {
  const issue = { subject: "user-1", type: "EmployeeCredential", claims: {}, ttl_seconds: 3600 };

  it("issues a credential with its signed JWT, with or without an expiry", async () => {
    const issued = {
      credential_id: "4d5e6f7a-8b9c-4d0e-a1f2-b3c4d5e6f7a8",
      jwt: "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.c2ln",
      expires_at: "2026-10-23T10:00:00Z",
    };
    respond(issued, 201);
    await expect(mutate(() => useIssueCredential(), issue)).resolves.toEqual(issued);

    const { expires_at: _omitted, ...noExpiry } = issued;
    respond(noExpiry, 201);
    await expect(mutate(() => useIssueCredential(), issue)).resolves.toEqual(noExpiry);
  });

  it("fails closed without the JWT", async () => {
    respond({ credential_id: "4d5e6f7a-8b9c-4d0e-a1f2-b3c4d5e6f7a8", token: "eyJ..." }, 201);
    await expect(mutate(() => useIssueCredential(), issue)).rejects.toMatchObject(MISMATCH);
  });
});

describe("agents", () => {
  const create = {
    name: "Triage bot",
    scopes: SCOPES,
    token_ttl_seconds: 600,
    sponsor_user_id: "u1",
  };
  const agent = {
    id: "8f9a0b1c-2d3e-4f5a-8b6c-7d8e9f0a1b2c",
    name: "Triage bot",
    scopes: SCOPES,
    token_ttl_seconds: 600,
    status: "active",
    disabled: false,
    sponsor_user_id: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
    created_at: "2026-10-23T09:00:00Z",
    secret: "qagt_s3cr3t",
  };

  it("creates an agent with its one-time secret", async () => {
    respond(agent, 201);
    await expect(mutate(() => useCreateAgent(), create)).resolves.toEqual(agent);
  });

  it("fails closed when the created agent has no secret", async () => {
    const { secret: _secret, ...withoutSecret } = agent;
    respond(withoutSecret, 201);
    await expect(mutate(() => useCreateAgent(), create)).rejects.toMatchObject(MISMATCH);
  });
});

describe("API keys", () => {
  const key = {
    id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    tenant_id: "tenant-a",
    user_id: null,
    name: "CI deploys",
    prefix: "qk_ab12cd34",
    scopes: SCOPES,
    expires_at: null,
    last_used_at: null,
    revoked_at: null,
    created_at: "2026-10-23T09:00:00Z",
  };

  it("lists a tenant's keys", async () => {
    respond({
      items: [key, { ...key, id: "k2", scopes: null, revoked_at: "2026-10-23T10:00:00Z" }],
    });
    await expect(listApiKeys("tenant-a")).resolves.toMatchObject({ items: [key, { id: "k2" }] });
    expect(proxyApiRequest.mock.calls[0]?.[0].data.path).toBe("/v1/tenants/tenant-a/api-keys");
  });

  it("fails closed when a key has no prefix to show", async () => {
    const { prefix: _prefix, ...withoutPrefix } = key;
    respond({ items: [withoutPrefix] });
    await expect(listApiKeys("tenant-a")).rejects.toMatchObject(MISMATCH);
  });

  it("creates a key with its one-time secret, passing a missing secret on for the page to report", async () => {
    const created = { api_key: key, secret: "qk_ab12cd34.s3cr3t", warning: "Store it now." };
    respond(created, 201);
    await expect(createApiKey({ tenant_id: "tenant-a", name: "CI deploys" })).resolves.toEqual(
      created,
    );

    respond({ api_key: key, warning: "Store it now." }, 201);
    await expect(createApiKey({ tenant_id: "tenant-a", name: "CI deploys" })).resolves.toEqual({
      api_key: key,
      warning: "Store it now.",
    });

    respond({ api_key: { ...key, id: 7 }, secret: "x" }, 201);
    await expect(createApiKey({ tenant_id: "tenant-a", name: "CI deploys" })).rejects.toMatchObject(
      MISMATCH,
    );
  });
});

describe("service principals", () => {
  const principal = {
    id: "6c7d8e9f-0a1b-4c2d-9e3f-4a5b6c7d8e9f",
    tenant_id: "tenant-a",
    name: "Payroll sync",
    scopes: SCOPES,
    disabled_at: null,
    created_at: "2026-10-23T09:00:00Z",
  };
  const input = { tenant_id: "tenant-a", name: "Payroll sync" };

  it("creates a machine identity with its one-time client secret", async () => {
    const created = {
      service_principal: principal,
      client_id: principal.id,
      client_secret: "qsp_s3cr3t",
      warning: "secret shown once",
    };
    respond(created, 201);
    await expect(createServicePrincipal(input)).resolves.toEqual(created);
  });

  it("fails closed on the flat shape the machine-identities screen assumes", async () => {
    respond({ ...principal, client_secret: "qsp_s3cr3t" }, 201);
    await expect(createServicePrincipal(input)).rejects.toMatchObject(MISMATCH);
  });
});
