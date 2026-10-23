// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ tenantId: "tenant-a" as string | null }));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => context.tenantId }));

import { api } from "@/platform/api/client";
import { userKeys } from "../api/keys";
import {
  useAssignRole,
  useBulkImportUsers,
  usePurgeUser,
  useRestoreUser,
  useSetUserPassword,
  useCreateUser,
  useDeleteUser,
  useResetUserMfa,
  useSetUserStatus,
  useUpdateUser,
  useUserStats,
  useUserTrends,
} from "../api/users";

// Cache entries a mutation should, or should not, refresh.
const USERS_LIST: QueryKey = userKeys.list("tenant-a", { limit: 25, offset: 0 });
const USER_ONE: QueryKey = userKeys.detail("tenant-a", "user-1");
const USER_TWO: QueryKey = userKeys.detail("tenant-a", "user-2");
const OTHER_TENANT: QueryKey = userKeys.list("tenant-b", { limit: 25, offset: 0 });

function setup<T>(hook: () => T) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  for (const key of [USERS_LIST, USER_ONE, USER_TWO, OTHER_TENANT]) {
    client.setQueryData(key, { seeded: true });
  }
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

describe("useUserStats", () => {
  it("reads the tenant's member counts", async () => {
    const stats = {
      total: 120,
      active: 100,
      suspended: 5,
      invited: 15,
      mfa_enabled: 80,
      mfa_missing: 40,
      new_last_30d: 20,
    };
    vi.mocked(api).mockResolvedValue(stats);
    const { result } = setup(() => useUserStats());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith("/v1/users/stats");
    expect(result.current.data).toEqual(stats);
  });

  it("caches counts per tenant, so switching tenant reads them again", async () => {
    vi.mocked(api).mockResolvedValue({ total: 1 });
    const { result, rerender } = setup(() => useUserStats());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    context.tenantId = "tenant-b";
    rerender();

    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  });

  it("does not ask before a tenant is selected, or when the caller opts out", () => {
    context.tenantId = null;
    const noTenant = setup(() => useUserStats());
    expect(noTenant.result.current.fetchStatus).toBe("idle");

    context.tenantId = "tenant-a";
    const optedOut = setup(() => useUserStats(false));
    expect(optedOut.result.current.fetchStatus).toBe("idle");

    expect(api).not.toHaveBeenCalled();
  });
});

describe("useUserTrends", () => {
  it("reads the 30-day series once a tenant is selected", async () => {
    vi.mocked(api).mockResolvedValue({ total: [1, 2], mfa_enabled: [0, 1] });
    const { result } = setup(() => useUserTrends());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith("/v1/users/trends");
    expect(result.current.data).toEqual({ total: [1, 2], mfa_enabled: [0, 1] });
  });

  it("does not ask before a tenant is selected", () => {
    context.tenantId = null;
    const { result } = setup(() => useUserTrends());
    expect(result.current.fetchStatus).toBe("idle");
    expect(api).not.toHaveBeenCalled();
  });
});

describe("useCreateUser", () => {
  it("creates the user without sending role_id, and refreshes the user list", async () => {
    vi.mocked(api).mockResolvedValue({ id: "new-user", email: "asha@example.test" });
    const { result, client } = setup(() => useCreateUser());

    let created: unknown;
    await act(async () => {
      created = await result.current.mutateAsync({
        email: "asha@example.test",
        tenant_id: "tenant-a",
        display_name: "Asha",
      });
    });

    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith("/v1/users", {
      method: "POST",
      body: { email: "asha@example.test", tenant_id: "tenant-a", display_name: "Asha" },
    });
    expect(created).toEqual({ id: "new-user", email: "asha@example.test" });
    expect(invalidated(client, USERS_LIST)).toBe(true);
  });

  it("assigns the initial role in the input's tenant once the user exists", async () => {
    vi.mocked(api).mockImplementation(async (path) =>
      path === "/v1/users" ? { id: "new-user" } : undefined,
    );
    const { result } = setup(() => useCreateUser());

    await act(async () => {
      await result.current.mutateAsync({
        email: "asha@example.test",
        tenant_id: "tenant-z",
        role_id: "role-admin",
      });
    });

    expect(vi.mocked(api).mock.calls).toEqual([
      [
        "/v1/users",
        { method: "POST", body: { email: "asha@example.test", tenant_id: "tenant-z" } },
      ],
      ["/v1/users/new-user/tenants/tenant-z/roles/role-admin", { method: "POST" }],
    ]);
  });

  it("refreshes the user list when the user is created but the role assignment fails", async () => {
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === "/v1/users") return { id: "new-user" };
      throw new Error("role refused");
    });
    const { result, client } = setup(() => useCreateUser());

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          email: "asha@example.test",
          tenant_id: "tenant-a",
          role_id: "role-admin",
        }),
      ).rejects.toThrow("role refused");
    });

    expect(invalidated(client, USERS_LIST)).toBe(true);
  });

  it("leaves the user list alone when the user could not be created", async () => {
    vi.mocked(api).mockRejectedValue(new Error("refused"));
    const { result, client } = setup(() => useCreateUser());

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          email: "asha@example.test",
          tenant_id: "tenant-a",
          role_id: "role-admin",
        }),
      ).rejects.toThrow("refused");
    });

    expect(api).toHaveBeenCalledTimes(1);
    expect(invalidated(client, USERS_LIST)).toBe(false);
  });
});

describe("useUpdateUser", () => {
  it("PATCHes the profile fields and refreshes the list and that user's detail", async () => {
    vi.mocked(api).mockResolvedValue({ id: "user-1" });
    const { result, client } = setup(() => useUpdateUser());

    await act(async () => {
      await result.current.mutateAsync({
        userId: "user-1",
        body: { display_name: "Asha R", phone: null },
      });
    });

    expect(api).toHaveBeenCalledWith("/v1/users/user-1", {
      method: "PATCH",
      body: { display_name: "Asha R", phone: null },
    });
    expect(invalidated(client, USERS_LIST)).toBe(true);
    expect(invalidated(client, USER_ONE)).toBe(true);
    expect(invalidated(client, USER_TWO)).toBe(false);
  });
});

describe("useSetUserStatus", () => {
  it("PATCHes only the status and refreshes the list and that user's detail", async () => {
    vi.mocked(api).mockResolvedValue({ id: "user-1", status: "suspended" });
    const { result, client } = setup(() => useSetUserStatus());

    await act(async () => {
      await result.current.mutateAsync({ userId: "user-1", status: "suspended" });
    });

    expect(api).toHaveBeenCalledWith("/v1/users/user-1", {
      method: "PATCH",
      body: { status: "suspended" },
    });
    expect(invalidated(client, USERS_LIST)).toBe(true);
    expect(invalidated(client, USER_ONE)).toBe(true);
    expect(invalidated(client, USER_TWO)).toBe(false);
  });

  it("leaves the caches alone when the change is refused", async () => {
    vi.mocked(api).mockRejectedValue(new Error("refused"));
    const { result, client } = setup(() => useSetUserStatus());

    await act(async () => {
      await expect(
        result.current.mutateAsync({ userId: "user-1", status: "active" }),
      ).rejects.toThrow("refused");
    });

    expect(invalidated(client, USERS_LIST)).toBe(false);
    expect(invalidated(client, USER_ONE)).toBe(false);
  });
});

describe("useDeleteUser", () => {
  it("DELETEs the user and refreshes the user list", async () => {
    const { result, client } = setup(() => useDeleteUser());

    await act(async () => {
      await result.current.mutateAsync("user-1");
    });

    expect(api).toHaveBeenCalledWith("/v1/users/user-1", { method: "DELETE" });
    expect(invalidated(client, USERS_LIST)).toBe(true);
  });
});

describe("useResetUserMfa", () => {
  it("DELETEs the user's factors and refreshes every view of their MFA state", async () => {
    vi.mocked(api).mockResolvedValue({ message: "ok" });
    const { result, client } = setup(() => useResetUserMfa());
    const posture = userKeys.view("tenant-a", "user-1", "security");
    client.setQueryData(posture, { seeded: true });

    await act(async () => {
      await result.current.mutateAsync("user-1");
    });

    expect(api).toHaveBeenCalledWith("/v1/users/user-1/mfa", { method: "DELETE" });
    expect(invalidated(client, USER_ONE)).toBe(true);
    expect(invalidated(client, posture)).toBe(true);
    expect(invalidated(client, USERS_LIST)).toBe(true);
    expect(invalidated(client, USER_TWO)).toBe(false);
  });
});

describe("useAssignRole", () => {
  it("assigns the role in the current tenant and refreshes the user list", async () => {
    const { result, client } = setup(() => useAssignRole());

    await act(async () => {
      await result.current.mutateAsync({ userId: "user-1", roleId: "role-viewer" });
    });

    expect(api).toHaveBeenCalledWith("/v1/users/user-1/tenants/tenant-a/roles/role-viewer", {
      method: "POST",
    });
    expect(invalidated(client, USERS_LIST)).toBe(true);
  });

  it("refuses without a selected tenant and sends nothing", async () => {
    context.tenantId = null;
    const { result, client } = setup(() => useAssignRole());

    await act(async () => {
      await expect(
        result.current.mutateAsync({ userId: "user-1", roleId: "role-viewer" }),
      ).rejects.toThrow("No tenant selected");
    });

    expect(api).not.toHaveBeenCalled();
    expect(invalidated(client, USERS_LIST)).toBe(false);
  });
});

describe("tenant scoping", () => {
  it("never refreshes another organization's users", async () => {
    const { result, client } = setup(() => useDeleteUser());

    await act(async () => {
      await result.current.mutateAsync("user-1");
    });

    expect(invalidated(client, USERS_LIST)).toBe(true);
    expect(invalidated(client, OTHER_TENANT)).toBe(false);
  });
});

describe("useRestoreUser and usePurgeUser", () => {
  it("restores a deleted user and refreshes the bin and the list", async () => {
    const { result, client } = setup(() => useRestoreUser());
    const bin = userKeys.deleted("tenant-a");
    client.setQueryData(bin, { items: [] });

    await act(async () => {
      await result.current.mutateAsync("user-1");
    });

    expect(api).toHaveBeenCalledWith("/v1/users/user-1/restore", { method: "POST" });
    expect(invalidated(client, bin)).toBe(true);
    expect(invalidated(client, USERS_LIST)).toBe(true);
  });

  it("purges a deleted user and refreshes the bin only", async () => {
    const { result, client } = setup(() => usePurgeUser());
    const bin = userKeys.deleted("tenant-a");
    client.setQueryData(bin, { items: [] });

    await act(async () => {
      await result.current.mutateAsync("user-1");
    });

    expect(api).toHaveBeenCalledWith("/v1/users/user-1/purge", { method: "DELETE" });
    expect(invalidated(client, bin)).toBe(true);
    expect(invalidated(client, USERS_LIST)).toBe(false);
  });
});

describe("useSetUserPassword", () => {
  it("POSTs the new password for that user", async () => {
    const { result } = setup(() => useSetUserPassword());

    await act(async () => {
      await result.current.mutateAsync({ userId: "user-1", password: "correct horse" });
    });

    expect(api).toHaveBeenCalledWith("/v1/users/user-1/password", {
      method: "POST",
      body: { password: "correct horse" },
    });
  });
});

describe("useBulkImportUsers", () => {
  it("sends only the user fields and names each refused row by its line in the file", async () => {
    vi.mocked(api).mockResolvedValue({
      succeeded: 1,
      failed: 1,
      errors: [
        {
          line: 2,
          email: "b@example.test",
          code: "auth.email_exists",
          field: "email",
          message: "backend text",
        },
      ],
    });
    const { result, client } = setup(() => useBulkImportUsers());

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync([
        { email: "a@example.test", line: 4 },
        { email: "b@example.test", display_name: "Bea", line: 9 },
      ]);
    });

    expect(api).toHaveBeenCalledWith("/v1/users/bulk", {
      method: "POST",
      body: {
        tenant_id: "tenant-a",
        users: [{ email: "a@example.test" }, { email: "b@example.test", display_name: "Bea" }],
      },
    });
    expect(outcome).toEqual({
      succeeded: 1,
      failed: 1,
      errors: [{ line: 9, email: "b@example.test", code: "auth.email_exists", field: "email" }],
    });
    expect(invalidated(client, USERS_LIST)).toBe(true);
  });
});
