// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({
  useOrganizationId: () => "t1",
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
const router = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/users", searchStr: "", hash: "" }),
  useNavigate: () => router.navigate,
  useSearch: () => ({}),
  Link: ({
    to,
    params,
    search,
    children,
    ...props
  }: ComponentProps<"a"> & {
    to: string;
    params?: { userId: string };
    search?: Record<string, string>;
    children?: ReactNode;
  }) => {
    const path = to.replace("$userId", params?.userId ?? "");
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
import type { User, UserQuery } from "../api/users";
import { UsersPage, type UsersPageProps } from "../pages";
import { type PeopleFilters, recency } from "../people-model";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

function person(id: string, overrides: Partial<User> = {}): User {
  return {
    id,
    organization_id: "t1",
    email: `${id}@qeet.in`,
    display_name: id,
    status: "active",
    roles: ["Developer"],
    email_verified_at: ago(200),
    mfa_enabled: true,
    last_seen_at: ago(0.2),
    created_at: ago(200),
    metadata: { department: "Engineering" },
    phone: null,
    avatar_url: null,
    phone_verified_at: null,
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

const PEOPLE = [
  person("Priya", { id: "u-me", roles: ["owner"], display_name: "Priya Sharma" }),
  person("Arjun", { roles: ["Admin"], mfa_enabled: false, last_seen_at: ago(3) }),
  person("Meera", {
    mfa_enabled: false,
    email_verified_at: null,
    last_seen_at: null,
    metadata: { department: "Design" },
  }),
  person("Kiran", { status: "suspended", last_seen_at: ago(45), created_at: ago(10) }),
];

const STATS = {
  total: 4,
  active: 3,
  suspended: 1,
  invited: 0,
  mfa_enabled: 2,
  mfa_missing: 2,
  new_last_30d: 1,
  last_seen: { today: 1, week: 1, month: 0, older: 1, never: 1 },
  admins_without_mfa: 1,
  email_unverified: 1,
  by_role: [
    { role: "Developer", count: 2 },
    { role: "Admin", count: 1 },
    { role: "owner", count: 1 },
  ],
  by_department: [
    { department: "Engineering", count: 3 },
    { department: "Design", count: 1 },
  ],
};

// The list API, as the server answers it: each filter narrows, and the total counts them all. The
// query arrives as the transport sends it, a boolean as its word.
type Sent = Omit<UserQuery, "email_verified" | "admins_without_mfa" | "in_group"> & {
  email_verified?: string;
  admins_without_mfa?: string;
  in_group?: string;
  limit?: number;
};
const ADMINS = ["owner", "admin"];
function find(query: Sent) {
  const found = PEOPLE.filter(
    (u) =>
      (!query.q || personMatches(u, query.q)) &&
      (!query.status || u.status === query.status) &&
      (!query.role || (u.roles ?? []).some((r) => r.toLowerCase() === query.role?.toLowerCase())) &&
      (!query.department || u.metadata?.department === query.department) &&
      (!query.mfa || u.mfa_enabled === (query.mfa === "on")) &&
      (!query.email_verified || String(!!u.email_verified_at) === query.email_verified) &&
      (!query.admins_without_mfa ||
        String((u.roles ?? []).some((r) => ADMINS.includes(r.toLowerCase())) && !u.mfa_enabled) ===
          query.admins_without_mfa) &&
      (!query.in_group || String((u.groups_count ?? 0) > 0) === query.in_group) &&
      (!query.last_seen || recency(u, Date.now()) === query.last_seen),
  );
  return { items: found.slice(0, query.limit), total: found.length };
}
const personMatches = (u: User, q: string) =>
  [u.display_name, u.email].some((f) => f?.toLowerCase().includes(q.toLowerCase()));

type Pages = Record<string, { items: User[]; next_cursor?: string; total?: number }>;
// Set to answer the list's reads by cursor instead.
let pages: Pages | null;
let stats: typeof STATS;

const listReads = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([path]) => path === "/v1/users")
    .map(([, opts]) => (opts as { query?: unknown } | undefined)?.query);

beforeEach(() => {
  granted.except = new Set();
  pages = null;
  stats = STATS;
  vi.mocked(api).mockImplementation(
    async (path: string, opts?: { query?: Sent & { cursor?: string } }) => {
      if (path === "/v1/users") {
        if (!pages) return find(opts?.query ?? {});
        const page = pages[opts?.query?.cursor ?? ""];
        if (!page) throw new Error(`unexpected cursor ${opts?.query?.cursor}`);
        return { total: PEOPLE.length, ...page };
      }
      if (path === "/v1/users/stats") return stats;
      if (path === "/v1/users/trends")
        return {
          total: Array.from({ length: 30 }, (_, i) => (i < 20 ? 3 : 4)),
          mfa_enabled: Array.from({ length: 30 }, () => 2),
        };
      if (path === "/v1/organizations/t1/invites")
        return {
          items: [
            {
              id: "i1",
              organization_id: "t1",
              email: "a@qeet.in",
              status: "pending",
              expires_at: ago(-5),
              created_at: ago(1),
            },
          ],
        };
      if (path === "/v1/organizations/t1/roles")
        return { items: [{ id: "r-admin", name: "Admin" }] };
      if (path === "/v1/organizations/t1/groups") return { items: [] };
      throw new Error(`unexpected request: ${path}`);
    },
  );
});
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
  router.navigate.mockReset();
});

function renderPage(
  filters: PeopleFilters = {},
  onFiltersChange: UsersPageProps["onFiltersChange"] = vi.fn(),
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <UsersPage filters={filters} onFiltersChange={onFiltersChange} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
  return { onFiltersChange };
}

describe("the Users list", () => {
  it("leads with the key numbers: people, two-step against its target, last active, needs a look", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Users", level: 1 })).toBeTruthy();
    expect(
      screen.getByText("Everyone in Qeet Group, how they sign in, and who needs a look."),
    ).toBeTruthy();
    expect(await screen.findByText("3 active · +1 in the last 30 days")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("2 of 4 people · target 80%")).toBeTruthy();
    expect(screen.getByRole("link", { name: "2 without it →" }).getAttribute("href")).toBe(
      "/users?twostep=off",
    );

    const thisWeek = screen.getByRole("link", { name: "1 this week" });
    expect(thisWeek.getAttribute("href")).toBe("/users?seen=week");
    expect(screen.getByRole("link", { name: "1 today" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "1 longer ago" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "1 never" })).toBeTruthy();

    const admins = screen.getByRole("link", { name: /Admins without two-step/ });
    expect(admins.textContent).toContain("1");
    expect(admins.getAttribute("href")).toBe("/users?look=admins-no-two-step");
    expect(screen.getByRole("link", { name: /Not seen for 30 days/ }).textContent).toContain("1");
    expect(screen.getByRole("link", { name: /Email not verified/ }).textContent).toContain("1");
    expect(
      screen.getByRole("img", { name: "People each day: 3 to 4 over the last 30 days" }),
    ).toBeTruthy();
  });

  it("counts from the server's figures for the whole organisation, not the rows it has read", async () => {
    stats = {
      ...STATS,
      total: 5400,
      active: 5000,
      last_seen: { today: 1200, week: 2000, month: 1000, older: 900, never: 300 },
      admins_without_mfa: 7,
    };
    renderPage();
    expect(await screen.findByRole("link", { name: "1,200 today" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Admins without two-step/ }).textContent).toContain(
      "7",
    );
    expect(listReads()).toEqual([{ limit: 200 }]);
  });

  it("shows each person on one row: their role, how they sign in, and when they were last active", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "Users" });
    const arjun = (await within(table).findByText("Arjun")).closest("tr") as HTMLElement;
    expect(within(arjun).getByText("Admin")).toBeTruthy();
    expect(within(arjun).getByText("No two-step · admin")).toBeTruthy();
    const meera = within(table).getByText("Meera").closest("tr") as HTMLElement;
    expect(within(meera).getByText("Email not verified")).toBeTruthy();
    expect(within(meera).getByText("Never signed in")).toBeTruthy();
    const me = within(table).getByText("Priya Sharma").closest("tr") as HTMLElement;
    expect(within(me).getByText("You")).toBeTruthy();
    expect(within(me).getByText("Owner")).toBeTruthy();
    expect(
      within(me)
        .getByRole("link", { name: /^Priya Sharma/ })
        .getAttribute("href"),
    ).toBe("/users/u-me");
  });

  it("asks the server for the address's filters, shows what's applied and how many it leaves", async () => {
    renderPage({ twostep: "off", dept: "Engineering" });
    const table = await screen.findByRole("table", { name: "Users" });
    expect(await within(table).findByText("Arjun")).toBeTruthy();
    expect(within(table).queryByText("Meera")).toBeNull();
    expect(within(table).queryByText("Priya Sharma")).toBeNull();
    expect(screen.getByText("1 of 4 people")).toBeTruthy();
    expect(listReads()).toEqual([{ mfa: "off", department: "Engineering", limit: 200 }]);
  });

  it("asks for a look as the server's filter", async () => {
    renderPage({ look: "unverified" });
    const table = await screen.findByRole("table", { name: "Users" });
    expect(await within(table).findByText("Meera")).toBeTruthy();
    expect(within(table).queryByText("Arjun")).toBeNull();
    expect(listReads()).toEqual([{ email_verified: "false", limit: 200 }]);
  });

  it("puts a removed filter's change in the address", async () => {
    const { onFiltersChange } = renderPage({ twostep: "off", dept: "Engineering", q: "ar" });
    fireEvent.click(await screen.findByRole("button", { name: /Remove.*Two-step/ }));
    expect(onFiltersChange).toHaveBeenCalledWith({
      dept: "Engineering",
      q: "ar",
      twostep: undefined,
    });
  });

  it("says when no one matches, and clears the filters from there", async () => {
    const { onFiltersChange } = renderPage({ look: "suspended", twostep: "off" });
    expect(await screen.findByText("No one matches")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onFiltersChange).toHaveBeenCalledWith({});
  });

  it("doesn't ask when two filters can't both hold", async () => {
    renderPage({ look: "dormant", seen: "today" });
    expect(await screen.findByText("No one matches")).toBeTruthy();
    expect(listReads()).toEqual([]);
  });

  it("drops the last list's pager when the filters change to ones that can't both hold", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const page = (filters: PeopleFilters) => (
      <QueryClientProvider client={client}>
        <SensitiveActionProvider>
          <UsersPage filters={filters} onFiltersChange={vi.fn()} />
        </SensitiveActionProvider>
      </QueryClientProvider>
    );
    const { rerender } = render(page({ look: "dormant" }));
    const table = await screen.findByRole("table", { name: "Users" });
    expect(await within(table).findByText("Kiran")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeTruthy();
    rerender(page({ look: "dormant", seen: "today" }));
    expect(await screen.findByText("No one matches")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
  });

  it("reads the next page with the server's cursor once the table reaches it", async () => {
    pages = {
      "": { items: PEOPLE.slice(0, 2), next_cursor: "c2" },
      c2: { items: PEOPLE.slice(2) },
    };
    renderPage();
    const table = await screen.findByRole("table", { name: "Users" });
    expect(await within(table).findByText("Kiran")).toBeTruthy();
    expect(listReads()).toEqual([{ limit: 200 }, { limit: 200, cursor: "c2" }]);
  });

  it("asks the server for the admins without two-step", async () => {
    renderPage({ look: "admins-no-two-step" });
    const table = await screen.findByRole("table", { name: "Users" });
    expect(await within(table).findByText("Arjun")).toBeTruthy();
    expect(within(table).queryByText("Meera")).toBeNull();
    expect(listReads().at(-1)).toEqual({ admins_without_mfa: "true", limit: 200 });
  });

  it("asks the server for the people in no group", async () => {
    renderPage({ group: "none" });
    await screen.findByRole("table", { name: "Users" });
    await waitFor(() => expect(listReads().at(-1)).toEqual({ in_group: "false", limit: 200 }));
  });

  it("pages a sorted list on to the end", async () => {
    pages = {
      "": {
        items: Array.from({ length: 200 }, (_, j) => person(`p${j}`)),
        next_cursor: "c1",
        total: 250,
      },
      c1: { items: Array.from({ length: 50 }, (_, j) => person(`q${j}`)), total: 250 },
    };
    renderPage();
    const table = await screen.findByRole("table", { name: "Users" });
    await within(table).findByText("p0");
    fireEvent.click(within(table).getByRole("button", { name: /Person/ }));
    await waitFor(() =>
      expect(listReads().at(-1)).toEqual({ sort: "name", order: "asc", limit: 200 }),
    );
    expect(screen.queryByText(/Sorted, the list shows/)).toBeNull();
    // Every order pages on, so the pager reaches all 250.
    await waitFor(() => expect(document.body.textContent).toContain("1–50 of 250"));
  });

  it("changes nothing on load", async () => {
    renderPage();
    await screen.findByText("3 active · +1 in the last 30 days");
    const writes = vi
      .mocked(api)
      .mock.calls.filter(([, opts]) => (opts as { method?: string } | undefined)?.method);
    expect(writes).toEqual([]);
  });

  it("is read-only without user.write: no selection, no row menus, no Add user", async () => {
    granted.except = new Set(["user.write"]);
    renderPage();
    const table = await screen.findByRole("table", { name: "Users" });
    await within(table).findByText("Arjun");
    expect(within(table).queryAllByRole("checkbox")).toEqual([]);
    expect(screen.queryByRole("button", { name: "Add user" })).toBeNull();
    expect(screen.getByText("Read-only access")).toBeTruthy();
  });
});
