// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return (options: Parameters<typeof run>[0]) => {
        sensitiveCalls.push(options);
        return run(options);
      };
    },
  };
});
const router = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, string | undefined>,
}));
// The page reads its search from its own route.
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: object) => ({
    options,
    useSearch: () => router.search,
    useNavigate: () => router.navigate,
  }),
  useNavigate: () => router.navigate,
  useRouterState: () => "/authorization/roles",
  Link: ({
    children,
    to,
    search,
    ...props
  }: React.ComponentProps<"a"> & { to: string; search?: Record<string, string> }) => (
    <a {...props} href={`${to}${search ? `?${new URLSearchParams(search)}` : ""}`}>
      {children}
    </a>
  ),
}));
vi.mock("@/modules/qeetai/context/context-registry", () => ({ useRegisterContext: () => {} }));
vi.mock("@/modules/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/dashboard")>()),
  PageBreadcrumb: () => null,
}));
vi.mock("@/modules/organizations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/organizations")>()),
  useOrgs: () => ({ data: { items: [{ id: "t-1", name: "Qeet Group" }] } }),
}));
vi.mock("@/shared/hooks/use-create-intent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/hooks/use-create-intent")>()),
  useCreateIntent: () => useState(false),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./roles";

const RolesRoute = Route.options.component as () => React.JSX.Element;

const role = (id: string, name: string, description: string, isSystem = false) => ({
  id,
  tenant_id: "t-1",
  name,
  description,
  is_system: isSystem,
  created_at: "2025-08-18T10:00:00Z",
});
const perm = (key: string) => ({ id: `p-${key}`, key, description: `Can ${key}` });
const CATALOGUE = [perm("user.read"), perm("user.write"), perm("role.read")];
const ROLES = [
  role("r-owner", "owner", "Tenant owner", true),
  role("r-help", "Helpdesk", "Reads members and resets their sign-in."),
];
const GRANTS: Record<string, string[]> = {
  "r-owner": ["user.read", "user.write", "role.read"],
  "r-help": ["user.read"],
};
const person = (id: string, name: string, roles: string[]) => ({
  id,
  tenant_id: "t-1",
  email: `${id}@qeet.in`,
  display_name: name,
  status: "active",
  roles,
  created_at: "2025-08-18T10:00:00Z",
});

beforeEach(() => {
  sensitiveCalls.length = 0;
  router.search = {};
  router.navigate.mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (method !== "GET") return undefined;
    if (path === "/v1/tenants/t-1/roles") return { items: ROLES };
    if (path === "/v1/permissions") return { items: CATALOGUE };
    const rolePerms = /^\/v1\/roles\/([^/]+)\/permissions$/.exec(path);
    if (rolePerms)
      return { items: CATALOGUE.filter((p) => GRANTS[rolePerms[1] ?? ""]?.includes(p.key)) };
    if (path === "/v1/users")
      return {
        items: [
          person("u-priya", "Priya Nair", ["owner"]),
          person("u-sam", "Sam Lee", ["Helpdesk"]),
          person("u-riya", "Riya Reddy", []),
        ],
        next_cursor: "",
      };
    if (path === "/v1/tenants/t-1/groups")
      return {
        items: [
          {
            id: "g-support",
            tenant_id: "t-1",
            parent_id: null,
            name: "Support",
            description: "",
            created_at: "2025-08-18T10:00:00Z",
            member_count: 1,
          },
        ],
      };
    if (path === "/v1/tenants/t-1/groups/g-support/roles")
      return {
        items: [{ role_id: "r-help", name: "Helpdesk", granted_at: "2025-08-18T10:00:00Z" }],
      };
    if (path === "/v1/groups/g-support/members")
      return {
        items: [{ user_id: "u-riya", email: "u-riya@qeet.in", display_name: "Riya Reddy" }],
      };
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});
afterEach(cleanup);

function renderRoles() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <RolesRoute />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function writes() {
  return vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => `${options?.method} ${path}`);
}

describe("Roles", () => {
  it("lists each role with who holds it, directly and through groups, and what it grants", async () => {
    renderRoles();
    const table = await screen.findByRole("table", { name: "Roles" });
    const helpdesk = await within(table).findByText("Helpdesk");
    const row = helpdesk.closest("tr") as HTMLElement;
    expect(within(row).getByText("Reads members and resets their sign-in.")).toBeTruthy();
    // Sam holds it himself; Riya through the Support group.
    await waitFor(() => expect(within(row).getByText("1 through groups")).toBeTruthy());
    expect(within(row).getByText("2")).toBeTruthy();
    expect(within(row).getByText("1 of 3")).toBeTruthy();
    expect(within(table).getByText("Built in")).toBeTruthy();
  });

  it("saves a role's permissions together, behind one step-up", async () => {
    router.search = { role: "r-help" };
    renderRoles();
    const drawer = await screen.findByRole("dialog", { name: "Helpdesk" });
    await within(drawer).findByRole("link", { name: "Support" });
    expect(within(drawer).getByText("Sam Lee")).toBeTruthy();

    fireEvent.click(
      await within(drawer).findByRole("checkbox", { name: "user.write: Can user.write" }),
    );
    fireEvent.click(within(drawer).getByRole("checkbox", { name: "user.read: Can user.read" }));
    expect(within(drawer).getByText(/1 to add, 1 to take away/)).toBeTruthy();
    fireEvent.click(within(drawer).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(writes()).toEqual([
        "POST /v1/roles/r-help/permissions/p-user.write",
        "DELETE /v1/roles/r-help/permissions/p-user.read",
      ]),
    );
    expect(sensitiveCalls).toEqual([
      expect.objectContaining({ actionLabel: "Change this role's permissions" }),
    ]);
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("keeps the owner role's permissions fixed", async () => {
    router.search = { role: "r-owner" };
    renderRoles();
    const drawer = await screen.findByRole("dialog", { name: "owner" });
    const box = await within(drawer).findByRole("checkbox", { name: "role.read: Can role.read" });
    expect(box.getAttribute("aria-disabled") ?? box.getAttribute("data-disabled")).not.toBeNull();
    expect(
      within(drawer).getByText(
        "The owner role always holds every permission; it can't be changed.",
      ),
    ).toBeTruthy();
    expect(within(drawer).queryByRole("button", { name: "Save changes" })).toBeNull();
  });
});
