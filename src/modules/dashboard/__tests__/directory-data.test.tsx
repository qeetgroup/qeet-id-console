// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({
  tenantId: "tenant-a" as string | null,
  state: "ready",
  allowed: new Set<string>(),
}));
const hooks = vi.hoisted(() => ({
  users: vi.fn(),
  organizations: vi.fn(),
  scim: vi.fn(),
  ldap: vi.fn(),
}));

vi.mock("@/modules/users", () => ({ useUserStats: hooks.users }));
vi.mock("@/modules/organizations", () => ({ useOrgs: hooks.organizations }));
vi.mock("@/modules/authentication", () => ({
  useScimConfig: hooks.scim,
  useLdapConnections: hooks.ldap,
}));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => context.tenantId }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: context.state,
    can: (permission: string) => context.allowed.has(permission),
    canAll: (permissions: string[]) =>
      permissions.every((permission) => context.allowed.has(permission)),
  }),
}));

import { api } from "@/platform/api/client";
import {
  countPendingInvitations,
  summarizeConnections,
  summarizeGroups,
  useDirectoryData,
} from "../api/directory";

function renderData(includeOverview = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useDirectoryData(includeOverview), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  context.tenantId = "tenant-a";
  context.state = "ready";
  context.allowed = new Set(["user.read", "role.read", "group.read", "connection.read"]);
  vi.mocked(api).mockResolvedValue({ items: [] });
});

afterEach(cleanup);

describe("Directory summaries", () => {
  it("counts only pending invitations that have not expired", () => {
    const now = Date.parse("2026-09-12T12:00:00Z");
    expect(
      countPendingInvitations(
        [
          { id: "pending", status: "pending", expires_at: "2026-09-13T12:00:00Z" },
          { id: "expired", status: "pending", expires_at: "2026-09-11T12:00:00Z" },
          { id: "accepted", status: "accepted", expires_at: "2026-09-13T12:00:00Z" },
          { id: "revoked", status: "revoked", expires_at: "2026-09-13T12:00:00Z" },
        ],
        now,
      ),
    ).toBe(1);
  });

  it("counts actual group hierarchy without inventing system groups", () => {
    expect(
      summarizeGroups([
        { id: "root" },
        { id: "another", parent_id: null },
        { id: "child", parent_id: "root" },
      ]),
    ).toEqual({ total: 3, topLevel: 2, nested: 1 });
  });

  it("does not count draft or disabled connections as enabled", () => {
    expect(
      summarizeConnections({ token_set: true }, [
        { status: "active" },
        { status: "draft" },
        { status: "disabled" },
      ]),
    ).toEqual({ total: 4, enabled: 2, inactive: 2, scimEnabled: 1, ldapTotal: 3, ldapActive: 1 });
    expect(summarizeConnections({ token_set: false }, []).total).toBe(0);
  });

  it("uses existing scoped endpoints and shares list query results", async () => {
    const { result } = renderData();
    await waitFor(() => expect(result.current.groups.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/invites");
    expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/groups");
    expect(api).toHaveBeenCalledWith("/v1/users/deleted");
    expect(result.current.deleted.data).toBe(0);
    expect(hooks.users).toHaveBeenCalledWith(true);
    expect(hooks.scim).toHaveBeenCalledWith(true);
  });

  it.each(["resolving", "error"])("does not request protected data while access is %s", (state) => {
    context.state = state;
    renderData();
    expect(api).not.toHaveBeenCalled();
    for (const hook of Object.values(hooks)) expect(hook).toHaveBeenCalledWith(false);
  });

  it("does not request data without an active organization", () => {
    context.tenantId = null;
    renderData();
    expect(api).not.toHaveBeenCalled();
    for (const hook of Object.values(hooks)) expect(hook).toHaveBeenCalledWith(false);
  });

  it("does not expose denied metrics or write actions", () => {
    context.allowed = new Set();
    const { result } = renderData();
    expect(api).not.toHaveBeenCalled();
    expect(hooks.users).toHaveBeenCalledWith(false);
    expect(hooks.ldap).toHaveBeenCalledWith(false);
    expect(result.current.permissions.addUser).toBe(false);
    expect(result.current.permissions.createGroup).toBe(false);
  });

  it("does not load invitation counts without role access", async () => {
    context.allowed.delete("role.read");
    const { result } = renderData();
    await waitFor(() => expect(result.current.groups.isSuccess).toBe(true));
    expect(api).not.toHaveBeenCalledWith("/v1/tenants/tenant-a/invites");
    expect(result.current.permissions.invitations).toBe(false);
  });

  it("keeps sidebar queries limited to counts and connection state", async () => {
    const { result } = renderData(false);
    await waitFor(() => expect(result.current.invitations.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledTimes(1);
    expect(hooks.organizations).toHaveBeenCalledWith(false);
    expect(hooks.users).toHaveBeenCalledWith(false);
    expect(hooks.ldap).toHaveBeenCalledWith(true);
  });
});
