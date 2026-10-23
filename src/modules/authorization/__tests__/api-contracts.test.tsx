// @vitest-environment jsdom
// Each hook's endpoint, method, body and query, its tenant scoping, the keys a mutation
// invalidates, and the toast meta the global handler reads.
import {
  QueryClient,
  QueryClientProvider,
  type QueryKey,
  type UseQueryResult,
} from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ tenantId: "tenant-a" as string | null }));

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => session.tenantId }));

import { api } from "@/platform/api/client";
import {
  useAbacEvaluate,
  useAbacPolicies,
  useAbacPolicy,
  useCreateAbacPolicy,
  useDeleteAbacPolicy,
  useUpdateAbacPolicy,
} from "../api/abac";
import { useExplainCheck } from "../api/access-check";
import { useAuditEvents } from "../api/audit";
import {
  useCreateRole,
  useGrantPermission,
  usePermissions,
  useRevokePermission,
  useRolePermissions,
  useRoles,
} from "../api/rbac";
import { authzKeys } from "../api/keys";
import { useGrantGroupRole, useGroupRoles, useRevokeGroupRole } from "../api/rbac-groups";
import {
  useCheckRelation,
  useDeleteTuple,
  useRelationGraph,
  useRelationTuples,
  useSubjectTuples,
  useWriteTuple,
} from "../api/relationships";

function harness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, invalidate, wrapper };
}

/** Runs a query hook to success and returns the harness, so the cache key can be checked. */
async function runQuery(hook: () => UseQueryResult<unknown>) {
  const h = harness();
  const { result } = renderHook(hook, { wrapper: h.wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return h;
}

/** Asserts that a query hook stays idle and requests nothing. */
async function expectIdle(hook: () => UseQueryResult<unknown>) {
  const h = harness();
  const { result } = renderHook(hook, { wrapper: h.wrapper });
  await act(async () => {});
  expect(result.current.fetchStatus).toBe("idle");
  expect(api).not.toHaveBeenCalled();
}

/** Asserts that a mutation with no tenant selected rejects before reaching the API. */
async function expectRefusedWithoutTenant<V>(
  hook: () => { mutateAsync: (variables: V) => Promise<unknown> },
  variables: V,
) {
  session.tenantId = null;
  const h = harness();
  const { result } = renderHook(hook, { wrapper: h.wrapper });
  await act(async () => {
    await expect(result.current.mutateAsync(variables)).rejects.toThrow("No tenant selected");
  });
  expect(api).not.toHaveBeenCalled();
  expect(h.invalidate).not.toHaveBeenCalled();
}

/** Runs one mutation and returns the keys it invalidated and its toast meta. */
async function runMutation<V>(
  hook: () => { mutateAsync: (variables: V) => Promise<unknown> },
  variables: V,
) {
  const h = harness();
  const { result } = renderHook(hook, { wrapper: h.wrapper });
  await act(async () => {
    await result.current.mutateAsync(variables);
  });
  const invalidated = h.invalidate.mock.calls.map(([filters]) => filters?.queryKey as QueryKey);
  const meta = h.client.getMutationCache().getAll()[0]?.options.meta;
  return { invalidated, meta };
}

beforeEach(() => {
  vi.clearAllMocks();
  session.tenantId = "tenant-a";
  vi.mocked(api).mockResolvedValue({ items: [] });
});

afterEach(cleanup);

describe("ABAC policies", () => {
  it("lists policies for the current tenant under a tenant-scoped key", async () => {
    const { client } = await runQuery(() => useAbacPolicies());
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/abac/policies");
    expect(client.getQueryData(authzKeys.abacPolicies("tenant-a"))).toEqual({ items: [] });
  });

  it("does not list policies without a tenant", async () => {
    session.tenantId = null;
    await expectIdle(() => useAbacPolicies());
  });

  it("reads one policy by id, and waits until an id is chosen", async () => {
    vi.mocked(api).mockResolvedValue({ id: "p1" });
    const { client } = await runQuery(() => useAbacPolicy("p1"));
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/abac/policies/p1");
    expect(client.getQueryData(authzKeys.abacPolicy("tenant-a", "p1"))).toEqual({ id: "p1" });

    vi.clearAllMocks();
    await expectIdle(() => useAbacPolicy(null));
  });

  const input = {
    name: "hr_view",
    description: "",
    effect: "allow" as const,
    resource_type: "employee_profile",
    action: "read",
    condition: null,
    priority: 30,
    enabled: true,
  };

  it("creates a policy and refreshes every tenant's policy list", async () => {
    const { invalidated, meta } = await runMutation(() => useCreateAbacPolicy(), input);
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/abac/policies", {
      method: "POST",
      body: input,
    });
    expect(invalidated).toEqual([authzKeys.abacPolicies("tenant-a")]);
    expect(meta).toEqual({
      successMessage: "authorization:toast.policyCreated",
      silentError: true,
    });
  });

  it("patches a policy and refreshes both the list and the detail", async () => {
    const { invalidated, meta } = await runMutation(() => useUpdateAbacPolicy("p1"), input);
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/abac/policies/p1", {
      method: "PATCH",
      body: input,
    });
    expect(invalidated).toEqual([authzKeys.abacPolicies("tenant-a")]);
    expect(meta).toEqual({
      successMessage: "authorization:toast.policyUpdated",
      silentError: true,
    });
  });

  it("deletes a policy and refreshes the list", async () => {
    const { invalidated, meta } = await runMutation(() => useDeleteAbacPolicy(), "p1");
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/abac/policies/p1", {
      method: "DELETE",
    });
    expect(invalidated).toEqual([authzKeys.abacPolicies("tenant-a")]);
    expect(meta).toEqual({ successMessage: "authorization:toast.policyDeleted" });
  });

  it("evaluates silently with the explain trace and invalidates nothing", async () => {
    const evaluation = {
      subject: { id: "u1" },
      resource: { type: "doc", id: "d1" },
      action: "read",
    };
    const { invalidated, meta } = await runMutation(() => useAbacEvaluate(), evaluation);
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/abac/evaluate", {
      method: "POST",
      body: evaluation,
      query: { explain: "true" },
    });
    expect(invalidated).toEqual([]);
    expect(meta).toEqual({ silent: true });
  });

  it("refuses to create a role or change a group's roles without a tenant", async () => {
    await expectRefusedWithoutTenant(() => useCreateRole(), { name: "Auditor", description: "" });
    await expectRefusedWithoutTenant(() => useGrantGroupRole("g1"), "role-1");
    await expectRefusedWithoutTenant(() => useRevokeGroupRole("g1"), "role-1");
  });

  it("refuses every policy write and evaluation without a tenant", async () => {
    await expectRefusedWithoutTenant(() => useCreateAbacPolicy(), input);
    await expectRefusedWithoutTenant(() => useUpdateAbacPolicy("p1"), input);
    await expectRefusedWithoutTenant(() => useDeleteAbacPolicy(), "p1");
    await expectRefusedWithoutTenant(() => useAbacEvaluate(), {
      subject: {},
      resource: { type: "doc", id: "d1" },
      action: "read",
    });
  });
});

describe("ReBAC relationship tuples", () => {
  it("lists tuples on an object, URL-encoding the object", async () => {
    const { client } = await runQuery(() => useRelationTuples("doc:a b/c"));
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/relation-tuples?object=doc%3Aa%20b%2Fc");
    expect(client.getQueryData(authzKeys.relationTuples("tenant-a", "doc:a b/c"))).toEqual({
      items: [],
    });
  });

  it("waits for both a tenant and an object before listing", async () => {
    await expectIdle(() => useRelationTuples(""));
    session.tenantId = null;
    await expectIdle(() => useRelationTuples("doc:1"));
  });

  it("reverse-looks-up tuples by subject, URL-encoding the subject", async () => {
    const { client } = await runQuery(() => useSubjectTuples("group:eng#member"));
    expect(api).toHaveBeenCalledWith(
      "/v1/tenants/tenant-a/relation-tuples?subject=group%3Aeng%23member",
    );
    expect(client.getQueryData(authzKeys.subjectTuples("tenant-a", "group:eng#member"))).toEqual({
      items: [],
    });

    vi.clearAllMocks();
    await expectIdle(() => useSubjectTuples(""));
  });

  it("expands the relation graph, passing depth only when given", async () => {
    vi.mocked(api).mockResolvedValue({ nodes: [], edges: [] });
    const withDepth = await runQuery(() => useRelationGraph("doc:1", "viewer", 3));
    expect(api).toHaveBeenLastCalledWith(
      "/v1/tenants/tenant-a/relation-tuples/graph?object=doc%3A1&relation=viewer&depth=3",
    );
    expect(
      withDepth.client.getQueryData(authzKeys.relationGraph("tenant-a", "doc:1", "viewer", 3)),
    ).toEqual({ nodes: [], edges: [] });

    await runQuery(() => useRelationGraph("doc:1", "viewer"));
    expect(api).toHaveBeenLastCalledWith(
      "/v1/tenants/tenant-a/relation-tuples/graph?object=doc%3A1&relation=viewer",
    );

    vi.clearAllMocks();
    await expectIdle(() => useRelationGraph("doc:1", ""));
  });

  it("writes a tuple and refreshes tuple lists, the relation graph and subject lookups", async () => {
    const tuple = { object: "doc:1", relation: "viewer", subject: "user:u1" };
    const { invalidated, meta } = await runMutation(() => useWriteTuple(), tuple);
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/relation-tuples", {
      method: "POST",
      body: tuple,
    });
    expect(invalidated).toEqual([authzKeys.relations("tenant-a")]);
    expect(meta).toEqual({ successMessage: "authorization:toast.tupleWritten", silentError: true });
  });

  it("deletes a tuple by id and refreshes tuple lists, the relation graph and subject lookups", async () => {
    const { invalidated, meta } = await runMutation(() => useDeleteTuple(), "t1");
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/relation-tuples/t1", {
      method: "DELETE",
    });
    expect(invalidated).toEqual([authzKeys.relations("tenant-a")]);
    expect(meta).toEqual({ successMessage: "authorization:toast.relationshipDeleted" });
  });

  it("checks a relation silently without the explain flag", async () => {
    const check = { object: "doc:1", relation: "viewer", user_id: "u1" };
    const { invalidated, meta } = await runMutation(() => useCheckRelation(), check);
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/relation-tuples/check", {
      method: "POST",
      body: check,
    });
    expect(invalidated).toEqual([]);
    expect(meta).toEqual({ silent: true });
  });

  it("refuses to write, delete or check tuples without a tenant", async () => {
    await expectRefusedWithoutTenant(() => useWriteTuple(), {
      object: "doc:1",
      relation: "viewer",
      subject: "user:u1",
    });
    await expectRefusedWithoutTenant(() => useDeleteTuple(), "t1");
    await expectRefusedWithoutTenant(() => useCheckRelation(), {
      object: "doc:1",
      relation: "viewer",
      user_id: "u1",
    });
  });

  it("refreshes a cached relation graph and subject lookup after a tuple write", async () => {
    const h = harness();
    h.client.setQueryData(authzKeys.relationGraph("tenant-a", "doc:1", "viewer"), {
      nodes: [],
      edges: [],
    });
    h.client.setQueryData(authzKeys.subjectTuples("tenant-a", "user:u1"), { items: [] });
    const { result } = renderHook(() => useWriteTuple(), { wrapper: h.wrapper });
    await act(async () => {
      await result.current.mutateAsync({ object: "doc:1", relation: "viewer", subject: "user:u1" });
    });
    const cache = h.client.getQueryCache();
    expect(
      cache.find({ queryKey: authzKeys.relationGraph("tenant-a", "doc:1", "viewer") })?.state
        .isInvalidated,
    ).toBe(true);
    expect(
      cache.find({ queryKey: authzKeys.subjectTuples("tenant-a", "user:u1") })?.state.isInvalidated,
    ).toBe(true);
  });
});

describe("RBAC roles and permissions", () => {
  it("reads the permission catalogue globally, even before a tenant is chosen", async () => {
    session.tenantId = null;
    const { client } = await runQuery(() => usePermissions());
    expect(api).toHaveBeenCalledWith("/v1/permissions");
    expect(client.getQueryData(authzKeys.permissions(null))).toEqual({ items: [] });
  });

  it("lists the tenant's roles under the shared roles key", async () => {
    const { client } = await runQuery(() => useRoles());
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/roles");
    expect(client.getQueryData(authzKeys.roles("tenant-a"))).toEqual({ items: [] });

    vi.clearAllMocks();
    session.tenantId = null;
    await expectIdle(() => useRoles());
  });

  it("creates a role and refreshes every roles query", async () => {
    const body = { name: "auditor", description: "Read-only" };
    const { invalidated, meta } = await runMutation(() => useCreateRole(), body);
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/roles", { method: "POST", body });
    expect(invalidated).toEqual([authzKeys.roles("tenant-a")]);
    expect(meta).toEqual({ successMessage: "authorization:toast.roleCreated", silentError: true });
  });

  it("reads a role's permissions by role id, and waits until a role is chosen", async () => {
    const { client } = await runQuery(() => useRolePermissions("r1"));
    expect(api).toHaveBeenCalledWith("/v1/roles/r1/permissions");
    expect(client.getQueryData(authzKeys.rolePermissions("tenant-a", "r1"))).toEqual({ items: [] });

    vi.clearAllMocks();
    await expectIdle(() => useRolePermissions(null));
  });

  it("grants a permission to a role and refreshes that role's permissions", async () => {
    const { invalidated, meta } = await runMutation(() => useGrantPermission("r1"), "perm-1");
    expect(api).toHaveBeenCalledWith("/v1/roles/r1/permissions/perm-1", { method: "POST" });
    expect(invalidated).toEqual([authzKeys.rolePermissions("tenant-a", "r1")]);
    expect(meta).toEqual({ successMessage: "authorization:toast.permissionGranted" });
  });

  it("revokes a permission from a role and refreshes that role's permissions", async () => {
    const { invalidated, meta } = await runMutation(() => useRevokePermission("r1"), "perm-1");
    expect(api).toHaveBeenCalledWith("/v1/roles/r1/permissions/perm-1", { method: "DELETE" });
    expect(invalidated).toEqual([authzKeys.rolePermissions("tenant-a", "r1")]);
    expect(meta).toEqual({ successMessage: "authorization:toast.permissionRevoked" });
  });
});

describe("RBAC group grants", () => {
  it("lists a group's roles, and waits for both tenant and group", async () => {
    const { client } = await runQuery(() => useGroupRoles("g1"));
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/groups/g1/roles");
    expect(client.getQueryData(authzKeys.groupRoles("tenant-a", "g1"))).toEqual({ items: [] });

    vi.clearAllMocks();
    await expectIdle(() => useGroupRoles(""));
    session.tenantId = null;
    await expectIdle(() => useGroupRoles("g1"));
  });

  it("grants a role to a group and refreshes only that group's roles", async () => {
    const { invalidated, meta } = await runMutation(() => useGrantGroupRole("g1"), "r1");
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/groups/g1/roles/r1", {
      method: "POST",
    });
    expect(invalidated).toEqual([authzKeys.groupRoles("tenant-a", "g1")]);
    expect(meta).toEqual({ successMessage: "authorization:toast.roleGrantedToGroup" });
  });

  it("revokes a role from a group and refreshes only that group's roles", async () => {
    const { invalidated, meta } = await runMutation(() => useRevokeGroupRole("g1"), "r1");
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/groups/g1/roles/r1", {
      method: "DELETE",
    });
    expect(invalidated).toEqual([authzKeys.groupRoles("tenant-a", "g1")]);
    expect(meta).toEqual({ successMessage: "authorization:toast.roleRevokedFromGroup" });
  });
});

describe("access explain check", () => {
  it("runs the explain check for the current tenant, silently", async () => {
    const { invalidated, meta } = await runMutation(() => useExplainCheck(), {
      user_id: "u1",
      permission: "users.read",
    });
    expect(api).toHaveBeenCalledWith("/v1/check", {
      query: { user_id: "u1", tenant_id: "tenant-a", permission: "users.read", explain: "true" },
    });
    expect(invalidated).toEqual([]);
    expect(meta).toEqual({ silent: true });
  });

  it("refuses the check when no tenant is selected", async () => {
    await expectRefusedWithoutTenant(() => useExplainCheck(), {
      user_id: "u1",
      permission: "users.read",
    });
  });
});

describe("authorization audit feed", () => {
  it("drops blank filters and defaults the page size to 100", async () => {
    const filter = { action: "", resource_type: "role", q: "" };
    const { client } = await runQuery(() => useAuditEvents(filter));
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/audit", {
      query: {
        action: undefined,
        resource_type: "role",
        actor_user_id: undefined,
        q: undefined,
        limit: 100,
        cursor: undefined,
      },
    });
    expect(client.getQueryData(authzKeys.audit("tenant-a", filter))).toEqual({ items: [] });
  });

  it("passes every filter through, and waits for a tenant", async () => {
    await runQuery(() =>
      useAuditEvents({
        action: "role.created",
        resource_type: "role",
        actor_user_id: "u1",
        q: "admin",
        limit: 25,
        cursor: "c2",
      }),
    );
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/audit", {
      query: {
        action: "role.created",
        resource_type: "role",
        actor_user_id: "u1",
        q: "admin",
        limit: 25,
        cursor: "c2",
      },
    });

    vi.clearAllMocks();
    session.tenantId = null;
    await expectIdle(() => useAuditEvents());
  });
});
