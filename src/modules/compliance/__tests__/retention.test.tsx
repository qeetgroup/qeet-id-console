// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ tenantId: "tenant-a" as string | null }));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => context.tenantId }));

import { userKeys } from "@/modules/users";
import { api } from "@/platform/api/client";
import { complianceKeys } from "../api/keys";
import { type RetentionPolicy, useRetentionPolicy } from "../api/retention";
import {
  useRetentionDue,
  useRunRetention,
  useUpdateRetentionPolicy,
} from "../api/retention-changes";

const DELETED_USERS: QueryKey = userKeys.deleted("tenant-a");
const USERS_LIST: QueryKey = ["users", "tenant-a", 25, 1];
const POLICY: QueryKey = complianceKeys.retention("tenant-a");
const DUE: QueryKey = complianceKeys.retentionDue("tenant-a");

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

describe("useRetentionPolicy", () => {
  it("reads the current tenant's retention policy", async () => {
    context.tenantId = "tenant-b";
    const policy: RetentionPolicy = { deleted_users_enabled: true, deleted_users_days: 30 };
    vi.mocked(api).mockResolvedValue(policy);
    const { result } = setup(() => useRetentionPolicy());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-b/retention");
    expect(result.current.data).toEqual(policy);
  });

  it("does not ask before a tenant is selected", () => {
    context.tenantId = null;
    expect(setup(() => useRetentionPolicy()).result.current.fetchStatus).toBe("idle");
    expect(api).not.toHaveBeenCalled();
  });
});

describe("useUpdateRetentionPolicy", () => {
  it("PUTs the policy and shows the saved policy without reading it again", async () => {
    const before: RetentionPolicy = { deleted_users_enabled: false, deleted_users_days: 90 };
    const saved: RetentionPolicy = { deleted_users_enabled: true, deleted_users_days: 30 };
    vi.mocked(api).mockImplementation(async (_path, opts) =>
      opts?.method === "PUT" ? saved : before,
    );
    const { result } = setup(() => ({
      policy: useRetentionPolicy(),
      update: useUpdateRetentionPolicy(),
    }));
    await waitFor(() => expect(result.current.policy.data).toEqual(before));

    await act(async () => {
      await result.current.update.mutateAsync({
        deleted_users_enabled: true,
        deleted_users_days: 30,
      });
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/retention", {
      method: "PUT",
      body: { deleted_users_enabled: true, deleted_users_days: 30 },
    });
    await waitFor(() => expect(result.current.policy.data).toEqual(saved));
    // One GET on mount, one PUT: the server's answer is written straight into the cache.
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("refreshes who the window makes due once the policy is saved", async () => {
    vi.mocked(api).mockResolvedValue({ deleted_users_enabled: true, deleted_users_days: 7 });
    const { result, client } = setup(() => useUpdateRetentionPolicy(), [DUE]);

    await act(async () => {
      await result.current.mutateAsync({ deleted_users_enabled: true, deleted_users_days: 7 });
    });

    expect(invalidated(client, DUE)).toBe(true);
  });

  it("keeps the cached policy when the save is refused", async () => {
    vi.mocked(api).mockRejectedValue(new Error("refused"));
    const { result, client } = setup(() => useUpdateRetentionPolicy(), [POLICY]);

    await act(async () => {
      await expect(
        result.current.mutateAsync({ deleted_users_enabled: true, deleted_users_days: 1 }),
      ).rejects.toThrow("refused");
    });

    expect(client.getQueryData(POLICY)).toEqual({ seeded: true });
  });
});

describe("useRetentionDue", () => {
  it("reads how many people the saved window makes due, without changing any cached data", async () => {
    vi.mocked(api).mockResolvedValue({ ripe_deleted_users: 4, deleted_users_days: 30 });
    const { result, client } = setup(() => useRetentionDue(), [DELETED_USERS, POLICY]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The server's preview only counts: a POST read like any query.
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/retention/preview", {
      method: "POST",
    });
    expect(result.current.data).toEqual({ ripe_deleted_users: 4, deleted_users_days: 30 });
    expect(invalidated(client, DELETED_USERS)).toBe(false);
    expect(client.getQueryData(POLICY)).toEqual({ seeded: true });
  });

  it("asks nothing without policy.read", () => {
    expect(setup(() => useRetentionDue(false)).result.current.fetchStatus).toBe("idle");
    expect(api).not.toHaveBeenCalled();
  });
});

describe("useRunRetention", () => {
  it("runs the purge and refreshes the deleted-users recycle bin and who's due", async () => {
    vi.mocked(api).mockResolvedValue({ purged: 4 });
    const { result, client } = setup(() => useRunRetention(), [DELETED_USERS, USERS_LIST, DUE]);

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync();
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/retention/run", { method: "POST" });
    expect(outcome).toEqual({ purged: 4 });
    expect(invalidated(client, DELETED_USERS)).toBe(true);
    expect(invalidated(client, DUE)).toBe(true);
    expect(invalidated(client, USERS_LIST)).toBe(false);
  });
});

describe("retention changes without a tenant", () => {
  it("refuses to save or run, and reads nothing, before a tenant is selected", async () => {
    context.tenantId = null;
    const { result } = setup(() => ({
      update: useUpdateRetentionPolicy(),
      due: useRetentionDue(),
      run: useRunRetention(),
    }));
    const m = result.current;
    expect(m.due.fetchStatus).toBe("idle");

    await act(async () => {
      const outcomes = await Promise.allSettled([
        m.update.mutateAsync({ deleted_users_enabled: true, deleted_users_days: 30 }),
        m.run.mutateAsync(),
      ]);
      for (const outcome of outcomes) {
        expect(outcome).toMatchObject({
          status: "rejected",
          reason: new Error("No tenant selected"),
        });
      }
    });

    expect(api).not.toHaveBeenCalled();
  });
});
