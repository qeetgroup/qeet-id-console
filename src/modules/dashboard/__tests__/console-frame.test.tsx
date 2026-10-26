// @vitest-environment jsdom
import { ThemeProvider } from "@qeetrix/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@/i18n";

const route = vi.hoisted(() => ({ pathname: "/users", pageHeader: false, navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: route.pathname, searchStr: "", hash: "" }),
  useNavigate: () => route.navigate,
  useMatches: ({ select }: { select: (m: unknown[]) => unknown }) =>
    select([{ staticData: { pageHeader: route.pageHeader } }]),
  Link: ({
    to,
    children,
    ...props
  }: ComponentProps<"a"> & { to: string; children?: ReactNode }) => (
    <a {...props} href={to}>
      {children}
    </a>
  ),
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: "ready",
    mode: "full",
    tenantId: "t1",
    permissions: new Set(["users:read"]),
    can: () => true,
    canAccessPath: () => true,
    retry: vi.fn(),
  }),
}));
const session = vi.hoisted(() => ({ logout: vi.fn(), tenantId: "t1" as string | null }));
vi.mock("@/platform/auth/session", () => ({
  useMe: () => ({ data: { id: "u1", email: "alan@example.com", display_name: "Alan Admin" } }),
  useLogout: () => ({ mutate: session.logout, isPending: false }),
  useTenantId: () => session.tenantId,
}));
const orgs = vi.hoisted(() => ({ items: [] as { id: string; name: string }[] }));
vi.mock("@/modules/organizations", () => ({
  orgQueries: {
    list: () => ({ queryKey: ["orgs", "list"], queryFn: async () => ({ items: orgs.items }) }),
  },
}));
const notes = vi.hoisted(() => ({
  data: { unread_count: 0, items: [] as Record<string, unknown>[] },
  markAll: vi.fn(),
}));
vi.mock("@/modules/developer", () => ({
  useNotifications: () => ({ isPending: false, isError: false, data: notes.data }),
  useMarkAllRead: () => ({ mutate: notes.markAll, isPending: false }),
}));

import { AccountMenu } from "../components/frame/account-menu";
import { ConsoleSidebar } from "../components/frame/console-sidebar";
import { currentNavItemUrl } from "../components/frame/current-page";
import { NotificationsPanel } from "../components/frame/notifications-panel";
import { PageNav } from "../components/frame/page-nav";
import { getNavGroups, translateNavigation } from "@/platform/config/navigation";

function renderInApp(node: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider storageKey="frame-test-theme">{node}</ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  route.pathname = "/users";
  route.pageHeader = false;
  session.tenantId = "t1";
  orgs.items = [];
  notes.data = { unread_count: 0, items: [] };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the navigation", () => {
  it("lists the overview pages, then each area opening to its pages, with the current marked", () => {
    route.pathname = "/users/42";
    renderInApp(<ConsoleSidebar />);
    const nav = screen.getByRole("navigation", { name: "Qeet ID" });
    expect(within(nav).getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe("/");
    // The area holding the current page starts open; its page is current on its detail pages.
    const users = within(nav).getByRole("link", { name: "Users" });
    expect(users.getAttribute("aria-current")).toBe("page");
    expect(
      within(nav).getByRole("button", { name: "Directory" }).getAttribute("aria-expanded"),
    ).toBe("true");
    // Sub-pages are the page's tabs, not rows here.
    expect(within(nav).queryByRole("link", { name: "Invitations" })).toBeNull();
  });

  it("ends with My account, one entry for the person's own pages, current on each of them", () => {
    route.pathname = "/account/security";
    renderInApp(<ConsoleSidebar />);
    const nav = screen.getByRole("navigation", { name: "Qeet ID" });
    const mine = within(nav).getByRole("link", { name: "My account" });
    expect(mine.getAttribute("href")).toBe("/account");
    expect(mine.getAttribute("aria-current")).toBe("page");
    // Its pages are listed inside it, not here.
    expect(within(nav).queryByRole("link", { name: "Security" })).toBeNull();
  });

  it("without an organisation, lists only My account and the way to choose one", () => {
    session.tenantId = null;
    route.pathname = "/account/profile";
    renderInApp(<ConsoleSidebar />);
    const nav = screen.getByRole("navigation", { name: "Qeet ID" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["My account"]);
    const choose = screen.getByRole("link", { name: "Choose an organisation" });
    expect(choose.getAttribute("href")).toBe("/select-organization");
  });

  it("finds the page a sub-page or detail path belongs to, the longest match winning", () => {
    const groups = translateNavigation(getNavGroups());
    expect(currentNavItemUrl(groups, "/invitations")).toBe("/users");
    expect(currentNavItemUrl(groups, "/users/42")).toBe("/users");
    expect(currentNavItemUrl(groups, "/")).toBe("/");
    expect(currentNavItemUrl(groups, "/nowhere")).toBeUndefined();
  });
});

describe("the breadcrumb and sub-page tabs above a page not yet rebuilt", () => {
  it("names the area and page, and moves between sub-pages", () => {
    route.pathname = "/invitations";
    renderInApp(<PageNav />);
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByText("Directory")).toBeTruthy();
    expect(within(crumbs).getByRole("link", { name: "Users" }).getAttribute("href")).toBe("/users");
    const tabs = screen.getByRole("tablist", { name: "Users views" });
    expect(
      within(tabs).getByRole("tab", { name: "Invitations" }).getAttribute("aria-selected"),
    ).toBe("true");
    fireEvent.click(within(tabs).getByRole("tab", { name: "Suspended" }));
    expect(route.navigate).toHaveBeenCalledWith({ to: "/users/suspended" });
  });

  it("leaves a rebuilt page's own header alone", () => {
    route.pageHeader = true;
    const { container } = renderInApp(<PageNav />);
    expect(container.textContent).toBe("");
  });
});

describe("the account menu", () => {
  it("holds only what's personal, and signs out", async () => {
    renderInApp(<AccountMenu onShortcuts={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("alan@example.com")).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: "My account" })).toBeTruthy();
    expect(within(menu).getAllByRole("menuitemradio")).toHaveLength(3);
    expect(within(menu).queryByRole("menuitem", { name: /Switch organisation/ })).toBeNull();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Sign out" }));
    expect(session.logout).toHaveBeenCalled();
  });

  it("offers to switch organisation to someone in two or more", async () => {
    orgs.items = [
      { id: "t1", name: "Org One" },
      { id: "t2", name: "Org Two" },
    ];
    renderInApp(<AccountMenu onShortcuts={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const item = await screen.findByRole("menuitem", { name: /Switch organisation/ });
    expect(item.textContent).toContain("You're in Org One");
    expect(item.getAttribute("href")).toBe("/select-organization");
  });
});

describe("the Notifications panel", () => {
  it("lists them, links only to console pages, and marks all as read", () => {
    notes.data = {
      unread_count: 1,
      items: [
        {
          id: "n1",
          kind: "alert",
          title: "New sign-in",
          created_at: "2026-10-26T09:00:00Z",
          href: "/security/audit-logs",
        },
        {
          id: "n2",
          kind: "info",
          title: "Elsewhere",
          created_at: "2026-10-26T08:00:00Z",
          read_at: "2026-10-26T08:30:00Z",
          href: "https://evil.example",
        },
      ],
    };
    renderInApp(<NotificationsPanel />);
    expect(screen.getByText("1 unread")).toBeTruthy();
    expect(screen.getByRole("link", { name: /New sign-in/ }).getAttribute("href")).toBe(
      "/security/audit-logs",
    );
    expect(screen.queryByRole("link", { name: /Elsewhere/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(notes.markAll).toHaveBeenCalled();
  });

  it("says when there's nothing new", () => {
    renderInApp(<NotificationsPanel />);
    expect(screen.getByText("You're all caught up")).toBeTruthy();
  });
});

describe("the account menu's theme", () => {
  it("chooses a theme without closing the menu", async () => {
    renderInApp(<AccountMenu onShortcuts={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const dark = await screen.findByRole("menuitemradio", { name: "Dark" });
    fireEvent.click(dark);
    await waitFor(() => expect(dark.getAttribute("aria-checked")).toBe("true"));
    expect(screen.getByRole("menu")).toBeTruthy();
  });
});
