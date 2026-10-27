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
import type { User } from "../api/users";
import { UsersPage, type UsersPageProps } from "../pages";
import type { PeopleFilters } from "../people-model";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

function person(id: string, overrides: Partial<User> = {}): User {
  return {
    id,
    tenant_id: "t1",
    email: `${id}@qeet.in`,
    display_name: id,
    status: "active",
    roles: ["Developer"],
    email_verified_at: ago(200),
    mfa_enabled: true,
    last_seen_at: ago(0.2),
    created_at: ago(200),
    metadata: { department: "Engineering" },
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
};

type Pages = Record<string, { items: User[]; next_cursor?: string }>;
let pages: Pages;
let stats: typeof STATS;

beforeEach(() => {
  granted.except = new Set();
  pages = { "": { items: PEOPLE } };
  stats = STATS;
  vi.mocked(api).mockImplementation(
    async (path: string, opts?: { query?: { cursor?: string } }) => {
      if (path === "/v1/users") {
        const page = pages[opts?.query?.cursor ?? ""];
        if (!page) throw new Error(`unexpected cursor ${opts?.query?.cursor}`);
        return page;
      }
      if (path === "/v1/users/stats") return stats;
      if (path === "/v1/tenants/t1/invites")
        return {
          items: [
            {
              id: "i1",
              tenant_id: "t1",
              email: "a@qeet.in",
              status: "pending",
              expires_at: ago(-5),
              created_at: ago(1),
            },
          ],
        };
      if (path === "/v1/tenants/t1/roles") return { items: [{ id: "r-admin", name: "Admin" }] };
      if (path === "/v1/tenants/t1/groups") return { items: [] };
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

  it("filters from the address, shows what's applied and how many it leaves", async () => {
    renderPage({ twostep: "off", dept: "Engineering" });
    const table = await screen.findByRole("table", { name: "Users" });
    expect(await within(table).findByText("Arjun")).toBeTruthy();
    expect(within(table).queryByText("Meera")).toBeNull();
    expect(within(table).queryByText("Priya Sharma")).toBeNull();
    expect(screen.getByText("1 of 4 people")).toBeTruthy();
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

  it("walks the whole list with its cursor, 200 at a time", async () => {
    pages = {
      "": { items: PEOPLE.slice(0, 2), next_cursor: "c2" },
      c2: { items: PEOPLE.slice(2) },
    };
    renderPage();
    const table = await screen.findByRole("table", { name: "Users" });
    expect(await within(table).findByText("Kiran")).toBeTruthy();
    const reads = vi.mocked(api).mock.calls.filter(([path]) => path === "/v1/users");
    expect(reads.map(([, opts]) => opts?.query)).toEqual([
      { limit: 200, cursor: undefined },
      { limit: 200, cursor: "c2" },
    ]);
  });

  it("says when the organisation has more people than the list loads", async () => {
    pages = {};
    for (let i = 0; i < 10; i++)
      pages[i ? `c${i}` : ""] = {
        items: Array.from({ length: 200 }, (_, j) => person(`p${i}-${j}`)),
        next_cursor: `c${i + 1}`,
      };
    stats = { ...STATS, total: 2400, active: 2400 };
    renderPage();
    expect(await screen.findByText("Showing the first 2,000 of 2,400 people")).toBeTruthy();
    expect(vi.mocked(api).mock.calls.filter(([path]) => path === "/v1/users")).toHaveLength(10);
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
