// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ tenantId: "tenant-a" as string | null }));
vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await import("@/platform/errors/api-error");
  return { api: vi.fn(), ApiError };
});
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => context.tenantId }));

import { api } from "@/platform/api/client";
import { userKeys } from "../api/keys";
import { ApiError } from "@/platform/errors/api-error";
import {
  useRevokeAllUserSessions,
  useSendPasswordReset,
  useSetMfaRequired,
  useUserAccess,
  useUserPermissions,
  useUserRecentActivity,
  useUserSecurity,
  useUserSessions,
  useUserSocialIdentities,
} from "../api/user360";

/** Renders the hook; mutation tests seed the caches it may refresh, query tests start empty. */
function setup<T>(hook: () => T, seed: QueryKey[] = []) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  for (const key of seed) client.setQueryData(key, { seeded: true });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(hook, { wrapper }) };
}

function invalidated(client: QueryClient, key: QueryKey) {
  return client.getQueryState(key)?.isInvalidated === true;
}

beforeEach(() => {
  context.tenantId = "tenant-a";
  vi.mocked(api).mockReset();
  vi.mocked(api).mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("per-user read surfaces", () => {
  it.each([
    ["security posture", useUserSecurity, "/v1/users/user-1/security"],
    ["access summary", useUserAccess, "/v1/users/user-1/access"],
  ] as const)("reads the user's %s", async (_name, useHook, path) => {
    vi.mocked(api).mockResolvedValue({ from: path });
    const { result } = setup(() => useHook("user-1"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith(path);
    expect(result.current.data).toEqual({ from: path });
  });

  it.each([
    ["security posture", useUserSecurity],
    ["live sessions", useUserSessions],
    ["access summary", useUserAccess],
  ] as const)("does not read the %s without a user id or when disabled", (_name, useHook) => {
    expect(setup(() => useHook("")).result.current.fetchStatus).toBe("idle");
    expect(setup(() => useHook("user-1", false)).result.current.fetchStatus).toBe("idle");
    expect(api).not.toHaveBeenCalled();
  });
});

describe("useUserSessions", () => {
  it("checks the sessions against the server's shape", async () => {
    vi.mocked(api).mockResolvedValue({ items: [] });
    const { result } = setup(() => useUserSessions("user-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [path, opts] = vi.mocked(api).mock.calls[0] ?? [];
    expect(path).toBe("/v1/users/user-1/sessions");
    const schema = (
      opts as {
        schema: { parse: (v: unknown) => unknown; safeParse: (v: unknown) => { success: boolean } };
      }
    ).schema;
    const session = {
      id: "s-1",
      ip: null,
      user_agent: "Mozilla/5.0",
      created_at: "2026-10-01T00:00:00Z",
      last_seen_at: "2026-10-02T00:00:00Z",
    };
    expect(schema.parse({ items: [session] })).toEqual({ items: [session] });
    expect(schema.safeParse({ items: null }).success).toBe(false);
    expect(schema.safeParse({ items: [{ ...session, last_seen_at: 1 }] }).success).toBe(false);
  });
});

describe("useUserPermissions", () => {
  it("reads the user's effective permissions in the current tenant", async () => {
    vi.mocked(api).mockResolvedValue({ permissions: ["user.read", "role.read"] });
    const { result } = setup(() => useUserPermissions("user-1"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith("/v1/users/user-1/tenants/tenant-a/permissions");
    expect(result.current.data).toEqual({ permissions: ["user.read", "role.read"] });
  });

  it.each([403, 404])("degrades to no permissions on a %i", async (status) => {
    vi.mocked(api).mockRejectedValue(new ApiError(status, "denied", "backend text"));
    const { result } = setup(() => useUserPermissions("user-1"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ permissions: [] });
  });

  it("surfaces any other failure", async () => {
    const failure = new ApiError(500, "internal", "backend text");
    vi.mocked(api).mockRejectedValue(failure);
    const { result } = setup(() => useUserPermissions("user-1"));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(failure);
  });

  it("does not ask without a tenant", () => {
    context.tenantId = null;
    const { result } = setup(() => useUserPermissions("user-1"));
    expect(result.current.fetchStatus).toBe("idle");
    expect(api).not.toHaveBeenCalled();
  });
});

describe("useUserSocialIdentities", () => {
  it("reads the user's linked identities", async () => {
    const items = [
      {
        id: "si-1",
        user_id: "user-1",
        tenant_id: "tenant-a",
        provider: "google",
        subject: "1234",
        linked_at: "2026-09-01T00:00:00Z",
      },
    ];
    vi.mocked(api).mockResolvedValue({ items });
    const { result } = setup(() => useUserSocialIdentities("user-1"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith("/v1/users/user-1/social/identities");
    expect(result.current.data).toEqual({ items });
  });

  it.each([403, 404])("degrades to no identities on a %i", async (status) => {
    vi.mocked(api).mockRejectedValue(new ApiError(status, "denied", "backend text"));
    const { result } = setup(() => useUserSocialIdentities("user-1"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ items: [] });
  });

  it("surfaces any other failure", async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(500, "internal", "backend text"));
    const { result } = setup(() => useUserSocialIdentities("user-1"));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUserRecentActivity", () => {
  it("reads the six most recent events about the user by default", async () => {
    const events = [{ id: "ev-1", title: "Signed in", at: "2026-10-01T00:00:00Z" }];
    vi.mocked(api).mockResolvedValue({ events });
    const { result } = setup(() => useUserRecentActivity("user-1"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith("/v1/activity", { query: { subject: "user-1", limit: 6 } });
    expect(result.current.data).toEqual({ events });
  });

  it("passes a custom limit", async () => {
    vi.mocked(api).mockResolvedValue({ events: [] });
    const { result } = setup(() => useUserRecentActivity("user-1", 20));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith("/v1/activity", { query: { subject: "user-1", limit: 20 } });
  });

  it.each([404, 503])("degrades to no events when the feed answers %i", async (status) => {
    vi.mocked(api).mockRejectedValue(new ApiError(status, "unavailable", "backend text"));
    const { result } = setup(() => useUserRecentActivity("user-1"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ events: [] });
  });

  it("surfaces a server error", async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(500, "internal", "backend text"));
    const { result } = setup(() => useUserRecentActivity("user-1"));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it.each([
    ["a network failure", new TypeError("Failed to fetch")],
    ["an unexpected client error", new Error("boom")],
  ])("surfaces %s instead of showing no events", async (_name, failure) => {
    vi.mocked(api).mockRejectedValue(failure);
    const { result } = setup(() => useUserRecentActivity("user-1"));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(failure);
  });

  it("does not ask without a user id or when disabled", () => {
    expect(setup(() => useUserRecentActivity("")).result.current.fetchStatus).toBe("idle");
    expect(setup(() => useUserRecentActivity("user-1", 6, false)).result.current.fetchStatus).toBe(
      "idle",
    );
    expect(api).not.toHaveBeenCalled();
  });
});

describe("useRevokeAllUserSessions", () => {
  it("revokes every session and refreshes that user's sessions and security posture", async () => {
    vi.mocked(api).mockResolvedValue({ revoked: 3 });
    const { result, client } = setup(
      () => useRevokeAllUserSessions(),
      [
        userKeys.view("tenant-a", "user-1", "sessions"),
        userKeys.view("tenant-a", "user-1", "security"),
        userKeys.view("tenant-a", "user-1", "access"),
        userKeys.view("tenant-a", "user-2", "sessions"),
      ],
    );

    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync("user-1");
    });

    expect(api).toHaveBeenCalledWith("/v1/users/user-1/sessions/revoke-all", { method: "POST" });
    expect(response).toEqual({ revoked: 3 });
    expect(invalidated(client, userKeys.view("tenant-a", "user-1", "sessions"))).toBe(true);
    expect(invalidated(client, userKeys.view("tenant-a", "user-1", "security"))).toBe(true);
    expect(invalidated(client, userKeys.view("tenant-a", "user-1", "access"))).toBe(false);
    expect(invalidated(client, userKeys.view("tenant-a", "user-2", "sessions"))).toBe(false);
  });
});

describe("useSetMfaRequired", () => {
  it("PUTs the flag and refreshes that user's security posture", async () => {
    vi.mocked(api).mockResolvedValue({ mfa_required: true });
    const { result, client } = setup(
      () => useSetMfaRequired(),
      [
        userKeys.view("tenant-a", "user-1", "security"),
        userKeys.view("tenant-a", "user-2", "security"),
      ],
    );

    await act(async () => {
      await result.current.mutateAsync({ userId: "user-1", required: true });
    });

    expect(api).toHaveBeenCalledWith("/v1/users/user-1/mfa-required", {
      method: "PUT",
      body: { required: true },
    });
    expect(invalidated(client, userKeys.view("tenant-a", "user-1", "security"))).toBe(true);
    expect(invalidated(client, userKeys.view("tenant-a", "user-2", "security"))).toBe(false);
  });
});

describe("useSendPasswordReset", () => {
  it("starts the public recovery flow for the user's address without the admin's session", async () => {
    const { result } = setup(() => useSendPasswordReset());

    await act(async () => {
      await result.current.mutateAsync("asha@example.test");
    });

    expect(api).toHaveBeenCalledWith("/v1/auth/forgot-password", {
      method: "POST",
      body: { email: "asha@example.test" },
      anonymous: true,
    });
  });
});
