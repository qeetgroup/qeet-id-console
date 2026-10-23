// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ tenantId: "tenant-a" as string | null }));

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => session.tenantId }));
vi.mock("@/modules/activity", () => ({
  DEFAULT_FILTERS: { q: "", from: "", types: [] },
  fetchActivityPage: vi.fn(),
}));

import { type ActivityEvent, fetchActivityPage } from "@/modules/activity";
import { api } from "@/platform/api/client";
import type { AuditEvent } from "../api/audit";
import { authzKeys } from "../api/keys";
import { describePolicyAction, usePolicyChanges } from "../api/policy-changes";

const FROM = "2026-10-01T00:00:00Z";

function activity(overrides: Partial<ActivityEvent> & Pick<ActivityEvent, "type">): ActivityEvent {
  return {
    id: `act-${overrides.type}`,
    category: "access",
    severity: "info",
    title: "",
    at: "2026-10-10T00:00:00Z",
    ...overrides,
  };
}

function audit(overrides: Partial<AuditEvent> & Pick<AuditEvent, "action">): AuditEvent {
  return {
    id: `aud-${overrides.action}`,
    tenant_id: "tenant-a",
    actor_user_id: "0123456789abcdef",
    actor_type: "user",
    resource_type: overrides.action.split(".")[0] ?? "",
    resource_id: "fedcba9876543210",
    ip: null,
    user_agent: null,
    request_id: null,
    created_at: "2026-10-10T00:00:00Z",
    ...overrides,
  };
}

function render(from = FROM, limit?: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => usePolicyChanges(from, limit), { wrapper });
  return { ...view, client };
}

beforeEach(() => {
  vi.clearAllMocks();
  session.tenantId = "tenant-a";
  vi.mocked(fetchActivityPage).mockResolvedValue({ events: [] });
  vi.mocked(api).mockResolvedValue({ items: [] });
});

afterEach(cleanup);

describe("describePolicyAction", () => {
  it.each([
    ["abac_policy.created", "Policy created", "created"],
    ["rbac_policy.updated", "Policy updated", "updated"],
    ["role.deleted", "Role deleted", "deleted"],
    ["relation_tuple.deleted", "Relationship deleted", "deleted"],
    ["relation.created", "Relationship created", "created"],
    ["role.permission_granted", "Role permission granted", "created"],
    ["permission.revoked", "Permission revoked", "deleted"],
    ["group_role.assigned", "Group role assigned", "created"],
    ["group_role.unassigned", "Group role unassigned", "deleted"],
    ["role.unassigned", "Role unassigned", "deleted"],
    ["security_policy.updated", "Security policy updated", "updated"],
    ["abac.evaluated", "Abac evaluated", "other"],
    ["custom_entity.did_stuff", "Custom entity did stuff", "other"],
    ["role", "Role", "other"],
  ] as const)("describes %s as %j (%s)", (action, title, kind) => {
    expect(describePolicyAction(action)).toEqual({ title, kind });
  });
});

describe("usePolicyChanges", () => {
  it("does not load without a tenant", async () => {
    session.tenantId = null;
    const { result } = render();
    await act(async () => {});
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchActivityPage).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });

  it("prefers the activity feed, keeping only authorization events, capped at the limit", async () => {
    vi.mocked(fetchActivityPage).mockResolvedValue({
      events: [
        activity({
          id: "a1",
          type: "abac_policy.created",
          title: "Policy hr_view created",
          target: { type: "abac_policy", id: "p1", label: "hr_view" },
          actor: { id: "user-1234567890", name: "Asha Rao" },
          at: "2026-10-12T00:00:00Z",
        }),
        activity({ id: "skip", type: "user.created", title: "User created" }),
        activity({ id: "a2", type: "role.updated", title: "Role updated" }),
        activity({ id: "a3", type: "permission.revoked", title: "Permission revoked" }),
      ],
    });
    const { result, client } = render(FROM, 2);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchActivityPage).toHaveBeenCalledWith({ q: "", from: FROM, types: [] }, "", 100);
    expect(api).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([
      {
        id: "a1",
        title: "Policy hr_view created",
        target: "hr_view",
        actor: "Asha Rao",
        at: "2026-10-12T00:00:00Z",
        kind: "created",
      },
      {
        id: "a2",
        title: "Role updated",
        target: "",
        actor: null,
        at: "2026-10-10T00:00:00Z",
        kind: "updated",
      },
    ]);
    expect(client.getQueryData(authzKeys.policyChanges("tenant-a", FROM, 2))).toEqual(
      result.current.data,
    );
  });

  it("fills gaps in activity events from the action, target and actor ids", async () => {
    vi.mocked(fetchActivityPage).mockResolvedValue({
      events: [
        activity({
          id: "a1",
          type: "relation_tuple.deleted",
          title: "",
          target: { type: "relation_tuple", id: "tuple-1" },
          actor: { id: "abcdef0123456789" },
        }),
        activity({ id: "a2", type: "role.created", target: { type: "role" } }),
      ],
    });
    const { result } = render();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      expect.objectContaining({
        title: "Relationship deleted",
        target: "tuple-1",
        actor: "abcdef01",
        kind: "deleted",
      }),
      expect.objectContaining({ title: "Role created", target: "role", actor: null }),
    ]);
  });

  it("falls back to the tenant audit log when the activity feed has no authorization events", async () => {
    vi.mocked(fetchActivityPage).mockResolvedValue({
      events: [activity({ type: "user.created", title: "User created" })],
    });
    vi.mocked(api).mockResolvedValue({
      items: [
        audit({ id: "e1", action: "abac_policy.updated" }),
        audit({ id: "old", action: "role.created", created_at: "2026-09-30T23:59:59Z" }),
        audit({ id: "e2", action: "user.created" }),
        audit({ id: "e3", action: "role.created", resource_id: null, actor_user_id: null }),
        audit({ id: "e4", action: "permission.revoked" }),
      ],
    });
    const { result } = render(FROM, 2);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/audit", { query: { limit: 100 } });
    expect(result.current.data).toEqual([
      {
        id: "e1",
        title: "Policy updated",
        target: "fedcba98",
        actor: "01234567",
        at: "2026-10-10T00:00:00Z",
        kind: "updated",
      },
      {
        id: "e3",
        title: "Role created",
        target: "role",
        actor: null,
        at: "2026-10-10T00:00:00Z",
        kind: "created",
      },
    ]);
  });

  it("keeps group-role and security-policy changes from either feed", async () => {
    vi.mocked(fetchActivityPage).mockResolvedValue({
      events: [
        activity({ id: "a1", type: "group_role.unassigned", title: "" }),
        activity({ id: "a2", type: "security_policy.updated", title: "" }),
      ],
    });
    const fromActivity = render();
    await waitFor(() => expect(fromActivity.result.current.isSuccess).toBe(true));
    expect(fromActivity.result.current.data?.map((c) => [c.id, c.title, c.kind])).toEqual([
      ["a1", "Group role unassigned", "deleted"],
      ["a2", "Security policy updated", "updated"],
    ]);
    cleanup();

    vi.mocked(fetchActivityPage).mockResolvedValue({ events: [] });
    vi.mocked(api).mockResolvedValue({
      items: [
        audit({ id: "e1", action: "group_role.assigned" }),
        audit({ id: "e2", action: "security_policy.updated" }),
      ],
    });
    const fromAudit = render();
    await waitFor(() => expect(fromAudit.result.current.isSuccess).toBe(true));
    expect(fromAudit.result.current.data?.map((c) => [c.id, c.title, c.kind])).toEqual([
      ["e1", "Group role assigned", "created"],
      ["e2", "Security policy updated", "updated"],
    ]);
  });

  it("caps the audit fallback at five changes by default", async () => {
    vi.mocked(api).mockResolvedValue({
      items: Array.from({ length: 8 }, (_, i) => audit({ id: `e${i}`, action: "role.updated" })),
    });
    const { result } = render();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((c) => c.id)).toEqual(["e0", "e1", "e2", "e3", "e4"]);
  });

  it("surfaces an activity-feed failure instead of masking it with the audit log", async () => {
    vi.mocked(fetchActivityPage).mockRejectedValue(new Error("activity 500"));
    const { result } = render();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(api).not.toHaveBeenCalled();
  });
});
