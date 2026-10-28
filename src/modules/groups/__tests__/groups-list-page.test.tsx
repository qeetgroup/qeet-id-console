// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({
  useTenantId: () => "t1",
  useUserId: () => "u-me",
  useSessionId: () => "session-1",
}));
const granted = vi.hoisted(() => ({ except: new Set<string>() }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => {
    const can = (c: string) => !granted.except.has(c);
    return { state: "ready", mode: "full", can, canAll: (cs: string[]) => cs.every(can) };
  },
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/groups", searchStr: "", hash: "" }),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  Link: ({
    to,
    params,
    search,
    children,
    ...props
  }: ComponentProps<"a"> & {
    to: string;
    params?: { groupId: string };
    search?: Record<string, string>;
    children?: ReactNode;
  }) => {
    const path = to.replace("$groupId", params?.groupId ?? "");
    const query = search ? new URLSearchParams(search).toString() : "";
    return (
      <a {...props} href={query ? `${path}?${query}` : path}>
        {children}
      </a>
    );
  },
}));
vi.mock("@/modules/organizations", () => ({
  useOrgs: () => ({ data: { items: [{ id: "t1", name: "Qeet Group" }] } }),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import type { Group } from "../api/groups";
import { GroupsListPage } from "../components/list/groups-list-page";
import type { GroupFilters } from "../groups-model";

const group = (id: string, name: string, members: number, parent: string | null = null): Group => ({
  id,
  tenant_id: "t1",
  parent_id: parent,
  name,
  description: parent ? "" : `Everyone in ${name}`,
  created_at: "2025-08-18T10:00:00Z",
  member_count: members,
});
const GROUPS = [
  group("eng", "Engineering", 1),
  group("pay", "Payments", 5, "eng"),
  group("sre", "Site Reliability", 6, "eng"),
  group("core", "Core", 2, "sre"),
  group("sec", "Security", 1),
  group("grc", "Governance", 0, "sec"),
];
const ROLES: Record<string, string[]> = { grc: ["Auditor"], sre: ["Developer"] };
const person = (id: string, groups: number) => ({
  id,
  tenant_id: "t1",
  email: `${id}@qeet.in`,
  display_name: id,
  status: "active",
  created_at: "2025-08-18T10:00:00Z",
  groups_count: groups,
});

beforeEach(() => {
  granted.except = new Set();
  vi.mocked(api).mockImplementation(async (path: string) => {
    if (path === "/v1/tenants/t1/groups") return { items: GROUPS };
    const roles = /^\/v1\/tenants\/t1\/groups\/([^/]+)\/roles$/.exec(path);
    if (roles)
      return {
        items: (ROLES[roles[1] ?? ""] ?? []).map((name) => ({
          role_id: name,
          name,
          granted_at: "2025-08-20T10:00:00Z",
        })),
      };
    if (path === "/v1/users")
      return { items: [person("Priya", 1), person("Arjun", 2), person("Mareedu", 0)] };
    if (path === "/v1/tenants/t1/roles") return { items: [] };
    if (path === "/v1/groups/templates") return { items: [] };
    throw new Error(`unexpected request: ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

function renderPage(filters: GroupFilters = {}, onFiltersChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <GroupsListPage filters={filters} onFiltersChange={onFiltersChange} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
  return { onFiltersChange };
}
const table = () => screen.getByRole("table", { name: "Groups" });

describe("the Groups list", () => {
  it("leads with the key numbers, each a filter", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Groups", level: 1 })).toBeTruthy();
    expect(
      screen.getByText(
        "How people in Qeet Group are grouped, and the roles each group gives them.",
      ),
    ).toBeTruthy();
    expect(await screen.findByText("2 at the top · 3 levels deep")).toBeTruthy();
    expect(screen.getByText("67%")).toBeTruthy();
    expect(screen.getByText("2 of 3 people")).toBeTruthy();
    expect(screen.getByRole("link", { name: "1 in no group →" }).getAttribute("href")).toBe(
      "/users?group=none",
    );
    expect(screen.getByRole("link", { name: "1 empty" }).getAttribute("href")).toBe(
      "/groups?size=empty",
    );
    const looks = await screen.findByRole("link", { name: /Grant roles to no one/ });
    expect(looks.getAttribute("href")).toBe("/groups?look=unused-roles");
    expect(looks.textContent).toContain("1");
  });

  it("shows the groups as a tree whose families fold", async () => {
    renderPage();
    expect(await within(table()).findByRole("link", { name: "Core" })).toBeTruthy();
    const eng = within(table())
      .getByRole("link", { name: "Engineering" })
      .closest("tr") as HTMLElement;
    expect(eng.textContent).toContain("3 groups inside");
    expect(eng.textContent).toContain("+13 in its groups");
    expect(within(table()).getByRole("link", { name: "Payments" }).getAttribute("href")).toBe(
      "/groups/pay",
    );

    const fold = within(eng).getByRole("button", { name: "Hide the groups in Engineering" });
    expect(fold.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(fold);
    expect(within(table()).queryByRole("link", { name: "Payments" })).toBeNull();
    fireEvent.click(within(eng).getByRole("button", { name: "Show the 3 groups in Engineering" }));
    expect(within(table()).getByRole("link", { name: "Payments" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(within(table()).queryByRole("link", { name: "Payments" })).toBeNull();
    expect(within(table()).getByRole("link", { name: "Security" })).toBeTruthy();
  });

  it("lists matches flat, each with where it sits", async () => {
    renderPage({ q: "co" });
    const core = (await within(table()).findByRole("link", { name: "Core" })).closest("tr");
    expect(core?.textContent).toContain("Engineering › Site Reliability");
    expect(within(table()).queryByRole("link", { name: "Engineering" })).toBeNull();
    expect(screen.getByText("1 of 6 groups")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Collapse all" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
  });

  it("shows the roles each group grants", async () => {
    renderPage();
    const grc = (await within(table()).findByRole("link", { name: "Governance" })).closest(
      "tr",
    ) as HTMLElement;
    expect(await within(grc).findByText("Auditor")).toBeTruthy();
    expect(grc.textContent).toContain("No one");
  });

  it("without role.read, leaves roles out and asks for none", async () => {
    granted.except = new Set(["role.read"]);
    renderPage();
    await within(table()).findByRole("link", { name: "Core" });
    expect(within(table()).queryByRole("columnheader", { name: "Roles granted" })).toBeNull();
    expect(vi.mocked(api).mock.calls.some(([p]) => /\/groups\/[^/]+\/roles$/.test(String(p)))).toBe(
      false,
    );
    expect(screen.queryByRole("link", { name: /Grant roles to no one/ })).toBeNull();
  });

  it("read only: says so, with no New group and no row menus", async () => {
    granted.except = new Set(["group.write"]);
    renderPage();
    await within(table()).findByRole("link", { name: "Core" });
    expect(screen.getByText("Read-only access")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New group" })).toBeNull();
    expect(within(table()).queryByRole("button", { name: /actions/i })).toBeNull();
  });
});
