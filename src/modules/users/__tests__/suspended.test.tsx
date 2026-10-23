// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({
  tenantId: "tenant-a" as string | null,
  allowed: new Set<string>(["user.read"]),
}));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => context.tenantId }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: "ready",
    can: (capability: string) => context.allowed.has(capability),
  }),
}));

import { api } from "@/platform/api/client";
import {
  DEFAULT_SUSPENDED_FILTERS,
  fetchSuspendedExport,
  type SuspendedDirectoryUser,
  type SuspendedUsersPage,
  safeSuspendedCsvValue,
  useReactivateUsers,
  useReviewSuspension,
  useSuspendedUsers,
} from "../api/suspended";

const SUSPENDED_LIST: QueryKey = ["users", "suspended", "tenant-a", DEFAULT_SUSPENDED_FILTERS];
const USERS_LIST: QueryKey = ["users", "tenant-a", 25, 1];
const USER_STATS: QueryKey = ["user-stats", "tenant-a"];

function member(id: string, overrides: Partial<SuspendedDirectoryUser> = {}) {
  return {
    id,
    email: `${id}@example.test`,
    display_name: null,
    avatar_url: null,
    team: "Engineering",
    reason: "policy_violation",
    source: "manual",
    risk: "high",
    review: "pending",
    suspended_at: "2026-09-10T12:00:00Z",
    last_sign_in: null,
    can_manage: true,
    ...overrides,
  } satisfies SuspendedDirectoryUser;
}

function page(items: SuspendedDirectoryUser[], total = items.length): SuspendedUsersPage {
  return {
    items,
    total,
    limit: 100,
    offset: 0,
    summary: { total, high_risk: 0, policy: 0, manual: 0, pending: 0 },
    reasons: [],
    risks: [],
    queue: [],
    teams: [],
  };
}

function members(count: number, from = 0) {
  return Array.from({ length: count }, (_, i) => member(`user-${from + i}`));
}

/** Renders the hook; mutation tests seed the caches it may refresh, query tests start empty. */
function setup<T>(hook: () => T, { seed = false } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (seed) {
    for (const key of [SUSPENDED_LIST, USERS_LIST, USER_STATS]) {
      client.setQueryData(key, { seeded: true });
    }
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(hook, { wrapper }) };
}

function invalidated(client: QueryClient, key: QueryKey) {
  return client.getQueryState(key)?.isInvalidated === true;
}

/** Mocks api() to apply the hook's opt-in response schema, as the transport does. */
function respondWith(raw: unknown) {
  vi.mocked(api).mockImplementation(async (_path, opts) =>
    opts?.schema ? opts.schema.parse(raw) : raw,
  );
}

beforeEach(() => {
  context.tenantId = "tenant-a";
  context.allowed = new Set(["user.read"]);
  vi.mocked(api).mockReset();
  vi.mocked(api).mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("useSuspendedUsers", () => {
  it("sends the filters as the query and returns the validated page", async () => {
    const response = page([member("user-1", { display_name: "Asha" })]);
    respondWith(response);
    const filters = { ...DEFAULT_SUSPENDED_FILTERS, q: "asha", risk: "high", offset: 25 };
    const { result } = setup(() => useSuspendedUsers(filters));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith(
      "/v1/users/suspended",
      expect.objectContaining({ query: filters }),
    );
    expect(result.current.data).toEqual(response);
  });

  it("rejects a page that breaks the response contract", async () => {
    respondWith(page([{ ...member("user-1"), risk: "extreme" as "high" }]));
    const { result } = setup(() => useSuspendedUsers(DEFAULT_SUSPENDED_FILTERS));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("does not ask without a tenant or without user.read", () => {
    context.tenantId = null;
    expect(
      setup(() => useSuspendedUsers(DEFAULT_SUSPENDED_FILTERS)).result.current.fetchStatus,
    ).toBe("idle");

    context.tenantId = "tenant-a";
    context.allowed = new Set();
    expect(
      setup(() => useSuspendedUsers(DEFAULT_SUSPENDED_FILTERS)).result.current.fetchStatus,
    ).toBe("idle");

    expect(api).not.toHaveBeenCalled();
  });
});

describe("useReactivateUsers", () => {
  it("reactivates each user in turn and refreshes users and member counts", async () => {
    const { result, client } = setup(() => useReactivateUsers(), { seed: true });

    await act(async () => {
      await result.current.mutateAsync(["user-1", "user-2"]);
    });

    expect(vi.mocked(api).mock.calls).toEqual([
      ["/v1/users/user-1/reactivate", { method: "POST" }],
      ["/v1/users/user-2/reactivate", { method: "POST" }],
    ]);
    expect(invalidated(client, SUSPENDED_LIST)).toBe(true);
    expect(invalidated(client, USERS_LIST)).toBe(true);
    expect(invalidated(client, USER_STATS)).toBe(true);
  });

  it("stops at the first refusal but still refreshes what may have changed", async () => {
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === "/v1/users/user-2/reactivate") throw new Error("refused");
      return undefined;
    });
    const { result, client } = setup(() => useReactivateUsers(), { seed: true });

    await act(async () => {
      await expect(result.current.mutateAsync(["user-1", "user-2", "user-3"])).rejects.toThrow(
        "refused",
      );
    });

    expect(vi.mocked(api).mock.calls.map(([path]) => path)).toEqual([
      "/v1/users/user-1/reactivate",
      "/v1/users/user-2/reactivate",
    ]);
    expect(invalidated(client, SUSPENDED_LIST)).toBe(true);
    expect(invalidated(client, USER_STATS)).toBe(true);
  });
});

describe("useReviewSuspension", () => {
  it("PUTs the review and refreshes only the suspended-users views", async () => {
    const { result, client } = setup(() => useReviewSuspension(), { seed: true });
    const review = { reason: "offboarding", risk: "low", review: "reviewed" as const };

    await act(async () => {
      await result.current.mutateAsync({ id: "user-1", review });
    });

    expect(api).toHaveBeenCalledWith("/v1/users/user-1/suspension", {
      method: "PUT",
      body: review,
    });
    expect(invalidated(client, SUSPENDED_LIST)).toBe(true);
    expect(invalidated(client, USERS_LIST)).toBe(false);
    expect(invalidated(client, USER_STATS)).toBe(false);
  });
});

describe("fetchSuspendedExport", () => {
  it("pages through the filtered list 100 at a time until every record is collected", async () => {
    vi.mocked(api).mockImplementation(async (_path, opts) => {
      const offset = Number(opts?.query?.offset);
      return offset === 0 ? page(members(100), 150) : page(members(50, 100), 150);
    });
    const filters = { ...DEFAULT_SUSPENDED_FILTERS, reason: "inactive", limit: 25, offset: 50 };

    const records = await fetchSuspendedExport(filters);

    expect(records).toHaveLength(150);
    expect(records[149]?.id).toBe("user-149");
    expect(vi.mocked(api).mock.calls.map(([path, opts]) => [path, opts?.query])).toEqual([
      ["/v1/users/suspended", { ...filters, limit: 100, offset: 0 }],
      ["/v1/users/suspended", { ...filters, limit: 100, offset: 100 }],
    ]);
  });

  it("stops when the server returns an empty page before the reported total", async () => {
    vi.mocked(api).mockImplementation(async (_path, opts) =>
      Number(opts?.query?.offset) === 0 ? page(members(100), 300) : page([], 300),
    );

    const records = await fetchSuspendedExport(DEFAULT_SUSPENDED_FILTERS);

    expect(records).toHaveLength(100);
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("refuses to export more than 10,000 records", async () => {
    vi.mocked(api).mockResolvedValue(page(members(100), 10_001));

    await expect(fetchSuspendedExport(DEFAULT_SUSPENDED_FILTERS)).rejects.toThrow(
      "Narrow the filters before exporting more than 10,000 records.",
    );
    expect(api).toHaveBeenCalledTimes(1);
  });
});

describe("safeSuspendedCsvValue", () => {
  it("neutralises values a spreadsheet would run as a formula", () => {
    for (const value of ["=SUM(A1)", "+1", "-1", "@cmd", "  =HYPERLINK()", "\tdata", "\rdata"]) {
      expect(safeSuspendedCsvValue(value)).toBe(`'${value}`);
    }
  });

  it("keeps ordinary values and blanks out missing ones", () => {
    expect(safeSuspendedCsvValue("Priya Sharma")).toBe("Priya Sharma");
    expect(safeSuspendedCsvValue("a-b@example.test")).toBe("a-b@example.test");
    expect(safeSuspendedCsvValue(null)).toBe("");
    expect(safeSuspendedCsvValue("")).toBe("");
  });
});
