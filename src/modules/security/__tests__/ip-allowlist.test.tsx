// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ tenantId: "tenant-a" as string | null }));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => context.tenantId }));

import { api } from "@/platform/api/client";
import {
  toAddressRefusal,
  useAddIpRule,
  useAddressRefusals,
  useCheckIp,
  useDeleteIpRule,
  useIpRules,
  useSetIpEnforcement,
} from "../api/ip-allowlist";
import { securityKeys } from "../api/keys";

const RULES: QueryKey = securityKeys.ipRules("tenant-a");
const REFUSALS: QueryKey = securityKeys.addressRefusals("tenant-a", 20);

/** Renders the hook; mutation tests seed the caches it may refresh, query tests start empty. */
function setup<T>(hook: () => T, { seed = false } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (seed) for (const key of [RULES, REFUSALS]) client.setQueryData(key, { seeded: true });
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

describe("useIpRules", () => {
  it("reads the current tenant's rules and enforcement flag", async () => {
    context.tenantId = "tenant-b";
    const response = {
      enabled: true,
      items: [
        {
          id: "rule-1",
          tenant_id: "tenant-b",
          cidr: "10.0.0.0/8",
          label: "Office",
          action: "allow",
          created_at: "2026-09-01T00:00:00Z",
        },
      ],
    };
    vi.mocked(api).mockResolvedValue(response);
    const { result } = setup(() => useIpRules());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-b/ip-rules");
    expect(result.current.data).toEqual(response);
  });

  it("does not ask before a tenant is selected", () => {
    context.tenantId = null;
    expect(setup(() => useIpRules()).result.current.fetchStatus).toBe("idle");
    expect(api).not.toHaveBeenCalled();
  });
});

describe("rule mutations", () => {
  it("switches enforcement on and refreshes the rules and refusals", async () => {
    vi.mocked(api).mockResolvedValue({ enabled: true });
    const { result, client } = setup(() => useSetIpEnforcement(), { seed: true });

    await act(async () => {
      await result.current.mutateAsync(true);
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/ip-rules/config", {
      method: "PUT",
      body: { enabled: true },
    });
    expect(invalidated(client, RULES)).toBe(true);
    expect(invalidated(client, REFUSALS)).toBe(true);
  });

  it("adds a rule and refreshes the rules", async () => {
    const { result, client } = setup(() => useAddIpRule(), { seed: true });
    const rule = { cidr: "203.0.113.7", label: "VPN", action: "deny" as const };

    await act(async () => {
      await result.current.mutateAsync(rule);
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/ip-rules", {
      method: "POST",
      body: rule,
    });
    expect(invalidated(client, RULES)).toBe(true);
  });

  it("removes a rule and refreshes the rules", async () => {
    const { result, client } = setup(() => useDeleteIpRule(), { seed: true });

    await act(async () => {
      await result.current.mutateAsync("rule-1");
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/ip-rules/rule-1", {
      method: "DELETE",
    });
    expect(invalidated(client, RULES)).toBe(true);
  });

  it("leaves the rules alone when a change is refused", async () => {
    vi.mocked(api).mockRejectedValue(new Error("would lock you out"));
    const { result, client } = setup(() => useSetIpEnforcement(), { seed: true });

    await act(async () => {
      await expect(result.current.mutateAsync(true)).rejects.toThrow("would lock you out");
    });

    expect(invalidated(client, RULES)).toBe(false);
  });

  it("refuses every rule change and address check before a tenant is selected, sending nothing", async () => {
    context.tenantId = null;
    const { result } = setup(() => ({
      enforce: useSetIpEnforcement(),
      add: useAddIpRule(),
      remove: useDeleteIpRule(),
      check: useCheckIp(),
    }));
    const m = result.current;

    await act(async () => {
      const outcomes = await Promise.allSettled([
        m.enforce.mutateAsync(true),
        m.add.mutateAsync({ cidr: "10.0.0.0/8", label: "Office", action: "allow" }),
        m.remove.mutateAsync("rule-1"),
        m.check.mutateAsync("198.51.100.4"),
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

describe("useCheckIp", () => {
  it("asks whether an address would be allowed without touching the cached rules", async () => {
    const verdict = { enabled: true, allowed: false, reason: "denied by rule" };
    vi.mocked(api).mockResolvedValue(verdict);
    const { result, client } = setup(() => useCheckIp(), { seed: true });

    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync("198.51.100.4");
    });

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/ip-rules/check", {
      method: "POST",
      body: { ip: "198.51.100.4" },
    });
    expect(response).toEqual(verdict);
    expect(invalidated(client, RULES)).toBe(false);
  });
});

describe("toAddressRefusal", () => {
  it("maps an auth.address_refused audit row, preferring the recorded address", () => {
    expect(
      toAddressRefusal({
        id: "audit-1",
        created_at: "2026-10-01T10:00:00Z",
        ip: "10.0.0.1",
        metadata: {
          address: "203.0.113.7",
          path: "/v1/auth/login",
          reason: "deny_rule",
          rule_id: "rule-1",
          cidr: "203.0.113.0/24",
        },
      }),
    ).toEqual({
      id: "audit-1",
      at: "2026-10-01T10:00:00Z",
      address: "203.0.113.7",
      path: "/v1/auth/login",
      reason: "deny_rule",
      ruleId: "rule-1",
      cidr: "203.0.113.0/24",
      actorUserId: null,
    });
  });

  it("falls back to the row's ip, and treats empty or non-text metadata as absent", () => {
    expect(
      toAddressRefusal({
        id: "audit-2",
        created_at: "2026-10-01T10:00:00Z",
        ip: "10.0.0.1",
        metadata: { address: "", path: 42, reason: null, rule_id: "", cidr: { v: 1 } },
      }),
    ).toEqual({
      id: "audit-2",
      at: "2026-10-01T10:00:00Z",
      address: "10.0.0.1",
      path: "",
      reason: "not_in_allow_rules",
      ruleId: null,
      cidr: null,
      actorUserId: null,
    });
  });

  it("reads the reason from the row when the list leaves metadata out", () => {
    // The deny rule is the event's resource; the person is its actor (ipallow.refusalEvent).
    expect(
      toAddressRefusal({
        id: "audit-5",
        created_at: "2026-10-01T10:00:00Z",
        ip: "192.0.2.10",
        actor_user_id: "user-1",
        resource_id: "rule-9",
      }),
    ).toMatchObject({ reason: "deny_rule", ruleId: "rule-9", actorUserId: "user-1" });
    expect(
      toAddressRefusal({ id: "audit-6", created_at: "2026-10-01T10:00:00Z", ip: "192.0.2.11" }),
    ).toMatchObject({ reason: "not_in_allow_rules", ruleId: null });
  });

  it("copes with a row that has no metadata and no ip", () => {
    expect(
      toAddressRefusal({ id: "audit-3", created_at: "2026-10-01T10:00:00Z", ip: null }),
    ).toEqual({
      id: "audit-3",
      at: "2026-10-01T10:00:00Z",
      address: "",
      path: "",
      reason: "address_unknown",
      ruleId: null,
      cidr: null,
      actorUserId: null,
    });
    expect(
      toAddressRefusal({
        id: "audit-4",
        created_at: "2026-10-01T10:00:00Z",
        ip: null,
        metadata: null,
      }).address,
    ).toBe("");
  });
});

describe("useAddressRefusals", () => {
  it("reads the latest 20 refusals from the tenant audit log and maps them", async () => {
    vi.mocked(api).mockResolvedValue({
      items: [
        {
          id: "audit-1",
          created_at: "2026-10-01T10:00:00Z",
          ip: "10.0.0.1",
          metadata: { reason: "not_in_allow_rules" },
        },
      ],
    });
    const { result } = setup(() => useAddressRefusals());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/audit", {
      query: { action: "auth.address_refused", limit: 20 },
    });
    expect(result.current.data).toEqual([
      {
        id: "audit-1",
        at: "2026-10-01T10:00:00Z",
        address: "10.0.0.1",
        path: "",
        reason: "not_in_allow_rules",
        ruleId: null,
        cidr: null,
        actorUserId: null,
      },
    ]);
  });

  it("passes a custom limit and treats a missing list as no refusals", async () => {
    vi.mocked(api).mockResolvedValue({});
    const { result } = setup(() => useAddressRefusals(5));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/audit", {
      query: { action: "auth.address_refused", limit: 5 },
    });
    expect(result.current.data).toEqual([]);
  });

  it("does not ask before a tenant is selected", () => {
    context.tenantId = null;
    expect(setup(() => useAddressRefusals()).result.current.fetchStatus).toBe("idle");
    expect(api).not.toHaveBeenCalled();
  });
});
