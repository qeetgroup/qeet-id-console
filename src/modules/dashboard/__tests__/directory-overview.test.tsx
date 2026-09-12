// @vitest-environment jsdom
import { SidebarProvider } from "@qeetrix/ui";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const intent = vi.hoisted(() => ({ action: undefined as string | undefined, navigate: vi.fn() }));

vi.mock("@/modules/users", () => ({ useUserStats: vi.fn() }));
vi.mock("@/modules/organizations", () => ({ useOrgs: vi.fn() }));
vi.mock("@/modules/authentication", () => ({
  useScimConfig: vi.fn(),
  useLdapConnections: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({
    pathname: "/directory",
    searchStr: intent.action ? "?action=create&sort=name" : "",
    hash: "",
  }),
  useSearch: () => ({ action: intent.action }),
  useNavigate: () => intent.navigate,
  Link: ({
    to,
    search,
    children,
    ...props
  }: ComponentProps<"a"> & {
    to: string;
    search?: Record<string, string>;
    children?: ReactNode;
  }) => (
    <a {...props} href={search ? `${to}?${new URLSearchParams(search)}` : to}>
      {children}
    </a>
  ),
}));

import { navGroups } from "@/platform/config/navigation";
import { parseCreateIntent, useCreateIntent } from "@/shared/hooks/use-create-intent";
import { DirectoryOverviewView, type DirectoryViewData } from "../components/directory-overview";
import { SectionNav } from "../components/nav-main";

function query<Data>(data: Data) {
  return { data, isPending: false, isError: false, isFetching: false, refetch: vi.fn() };
}

function fixture(): DirectoryViewData {
  return {
    tenantId: "tenant-a",
    accessState: "ready",
    permissions: {
      users: true,
      invitations: true,
      groups: true,
      connections: true,
      addUser: true,
      inviteUsers: true,
      createGroup: true,
      addConnection: true,
      billing: true,
    },
    users: query({
      total: 128,
      active: 123,
      suspended: 5,
      invited: 12,
      mfa_enabled: 90,
      mfa_missing: 38,
      new_last_30d: 8,
    }),
    invitations: query(12),
    deleted: query(3),
    groups: query({ total: 24, topLevel: 6, nested: 18 }),
    organizations: query({
      items: [
        {
          id: "tenant-a",
          slug: "qeet-group",
          name: "Qeet Group",
          status: "active",
          plan: "pro",
          region: "ap-south-1",
          logo_url: "",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    }),
    scim: query({ token_set: true, created_at: null, last_used_at: null, provisioned_count: 0 }),
    ldap: query({
      items: [
        {
          id: "ldap-a",
          tenant_id: "tenant-a",
          name: "Corporate directory",
          server_url: "ldaps://directory.example.test",
          start_tls: false,
          skip_tls_verify: false,
          bind_dn: "cn=reader",
          base_dn: "dc=example",
          user_filter: "(objectClass=person)",
          email_attribute: "mail",
          name_attribute: "cn",
          status: "active",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          last_login_at: null,
        },
      ],
    }),
  };
}

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
  intent.action = undefined;
  intent.navigate.mockClear();
});

describe("Directory overview", () => {
  it.each(["light", "dark"])("uses the same content and actions in %s mode", (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    const { container } = render(<DirectoryOverviewView data={fixture()} />);

    expect(screen.getAllByRole("article")).toHaveLength(4);
    const users = within(screen.getByRole("article", { name: "Users" }));
    expect(users.getByText("128")).toBeTruthy();
    expect(users.getByText("12")).toBeTruthy();
    expect(users.getByText("3")).toBeTruthy();
    expect(screen.getByText("SCIM, LDAP / AD")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Get more out of Qeet ID" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Add user" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Invite users" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Create group" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "View plan and billing" })).toBeTruthy();
    expect(container.querySelectorAll('a[href*="action=create"]')).toHaveLength(6);
    for (const element of container.querySelectorAll("[class]")) {
      expect(element.getAttribute("class")).not.toMatch(
        /\bdark:(hidden|block|flex|grid|order-|p[xy]-|m[xy]-)/,
      );
    }
  });

  it("offers both supported connection destinations", async () => {
    render(<DirectoryOverviewView data={fixture()} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Add directory connection" })[0]);
    expect((await screen.findByRole("menuitem", { name: "SCIM" })).getAttribute("href")).toBe(
      "/auth/connections/scim",
    );
    expect(screen.getByRole("menuitem", { name: "LDAP / AD" }).getAttribute("href")).toBe(
      "/auth/connections/ldap",
    );
  });

  it("shows unavailable metrics and retries only the failed request", () => {
    const data = fixture();
    data.users.isError = true;
    render(<DirectoryOverviewView data={data} />);
    const users = within(screen.getByRole("article", { name: "Users" }));
    expect(users.queryByText("128")).toBeNull();
    expect(users.getByText("Unavailable")).toBeTruthy();
    fireEvent.click(users.getByRole("button", { name: "Retry" }));
    expect(data.users.refetch).toHaveBeenCalledOnce();
    expect(data.invitations.refetch).not.toHaveBeenCalled();
  });

  it("uses skeletons instead of zero totals while loading", () => {
    const data = fixture();
    data.groups = { ...query(undefined), isPending: true, isFetching: true };
    render(<DirectoryOverviewView data={data} />);
    const groups = within(screen.getByRole("article", { name: "Groups" }));
    expect(groups.getAllByRole("status")).toHaveLength(3);
    expect(groups.queryByText("0")).toBeNull();
  });

  it("does not show denied areas, invite counts or write actions from cached data", () => {
    const data = fixture();
    data.permissions = {
      ...data.permissions,
      invitations: false,
      groups: false,
      connections: false,
      addUser: false,
      inviteUsers: false,
      createGroup: false,
      addConnection: false,
      billing: false,
    };
    render(<DirectoryOverviewView data={data} />);
    expect(screen.queryByRole("article", { name: "Groups" })).toBeNull();
    expect(screen.queryByRole("article", { name: "Directories" })).toBeNull();
    expect(screen.queryByText("12")).toBeNull();
    expect(screen.getByText("Restricted")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Add user" })).toBeNull();
    expect(screen.queryByRole("link", { name: "View plan and billing" })).toBeNull();
  });

  it("keeps a failed connection query from displaying an enabled total", () => {
    const data = fixture();
    data.ldap.isError = true;
    render(<DirectoryOverviewView data={data} />);
    const directories = within(screen.getByRole("article", { name: "Directories" }));
    expect(directories.getAllByText("Unavailable")).toHaveLength(2);
    expect(directories.queryByText("0")).toBeNull();
    expect(directories.getByText("SCIM, LDAP / AD")).toBeTruthy();
  });

  it("opens the unified Connections page from both directory management links", () => {
    render(<DirectoryOverviewView data={fixture()} />);
    const directories = within(screen.getByRole("article", { name: "Directories" }));
    for (const label of ["View directories", "Manage connections"]) {
      expect(directories.getByRole("link", { name: label }).getAttribute("href")).toBe(
        "/directory/connections",
      );
    }
  });

  it("offers organization setup instead of directory totals without an organization", () => {
    const data = fixture();
    data.tenantId = null;
    render(<DirectoryOverviewView data={data} />);
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByRole("heading", { name: "Choose an organization first" })).toBeTruthy();
  });

  it("opens existing creation forms only after permission resolves and consumes the URL intent", () => {
    intent.action = "create";
    const { result, rerender } = renderHook(({ enabled }) => useCreateIntent(enabled), {
      initialProps: { enabled: false },
    });
    expect(result.current[0]).toBe(false);
    expect(intent.navigate).not.toHaveBeenCalled();
    rerender({ enabled: true });
    expect(result.current[0]).toBe(true);
    const navigation = intent.navigate.mock.calls[0][0];
    expect(navigation.replace).toBe(true);
    expect(navigation.href).toBe("/directory?sort=name");
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    expect(intent.navigate).toHaveBeenCalledOnce();
  });

  it("keeps direct page visits closed and accepts only the create intent", () => {
    const { result } = renderHook(() => useCreateIntent(true));
    expect(result.current[0]).toBe(false);
    expect(intent.navigate).not.toHaveBeenCalled();
    expect(parseCreateIntent({ action: "create" })).toEqual({ action: "create" });
    expect(parseCreateIntent({ action: "delete" })).toEqual({});
    expect(parseCreateIntent({ action: true })).toEqual({});
  });

  it("expands Directory branches and links to every completed view", () => {
    const group = navGroups.find((item) => item.label === "Directory");
    if (!group) throw new Error("Directory navigation is missing");
    render(
      <SidebarProvider>
        <SectionNav
          group={group}
          badges={{
            "/invitations": { label: "12", description: "12 pending invitations", tone: "warning" },
          }}
        />
      </SidebarProvider>,
    );
    expect(screen.getByRole("button", { name: "Users" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(screen.getByRole("link", { name: "Invitations: 12 pending invitations" })).toBeTruthy();
    for (const [title, path] of [
      ["Suspended", "/users/suspended"],
      ["Connections", "/directory/connections"],
      ["Sync activity", "/directory/sync-activity"],
      ["Sync errors", "/directory/sync-errors"],
      ["Mappings", "/directory/attribute-mappings"],
    ]) {
      const item = screen.getByRole("link", { name: title });
      expect(item.getAttribute("href")).toBe(path);
      expect(item.getAttribute("aria-disabled")).not.toBe("true");
    }
    fireEvent.click(screen.getByRole("button", { name: "Users" }));
    expect(screen.getByRole("button", { name: "Users" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });
});
