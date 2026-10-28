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
  useTenantId: () => "g",
  useUserId: () => "u-me",
  useSessionId: () => "session-1",
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", mode: "full", can: () => true, canAll: () => true }),
}));
const switchToTenant = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/modules/authentication", () => ({ switchToTenant }));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/organizations", searchStr: "", hash: "" }),
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
    params?: { orgId: string };
    search?: Record<string, string>;
    children?: ReactNode;
  }) => {
    const path = to.replace("$orgId", params?.orgId ?? "");
    const query = search ? new URLSearchParams(search).toString() : "";
    return (
      <a {...props} href={query ? `${path}?${query}` : path}>
        {children}
      </a>
    );
  },
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import type { Org } from "../api/orgs";
import { OrgsListPage } from "../components/list/orgs-list-page";
import type { OrgFilters } from "../orgs-model";

const DAY = 86_400_000;
const org = (id: string, name: string, patch: Partial<Org> = {}): Org => ({
  id,
  slug: name.toLowerCase().replace(/ /g, "-"),
  name,
  status: "active",
  plan: "free",
  region: "ap-south-1",
  logo_url: "",
  created_at: "2025-08-18T09:00:00Z",
  member_count: 10,
  mfa_enabled_count: 9,
  ...patch,
});
const mine = (id: string, roles: string[], daysAgo: number, domain = "") => ({
  id,
  name: id,
  slug: id,
  plan: "free",
  region: "ap-south-1",
  logo_url: "",
  domain,
  roles,
  last_used_at: new Date(Date.now() - daysAgo * DAY).toISOString(),
});
// Two pages from the server, as /v1/tenants pages them.
const PAGE_ONE = [
  org("g", "Qeet Group", { plan: "enterprise", member_count: 46, mfa_enabled_count: 18 }),
  org("s", "Qeet Sandbox", { member_count: 3, mfa_enabled_count: 0 }),
];
const PAGE_TWO = [org("x", "Xeno", { status: "suspended", member_count: 1, mfa_enabled_count: 1 })];
const MINE = [
  mine("g", ["Admin"], 1, "qeet.in"),
  mine("s", ["owner"], 7),
  mine("x", ["Developer"], 60),
];

beforeEach(() => {
  switchToTenant.mockClear();
  vi.mocked(api).mockImplementation(async (path: string, options) => {
    const cursor = (options?.query?.cursor as string | undefined) ?? "";
    if (path === "/v1/tenants")
      return cursor === ""
        ? { items: PAGE_ONE, next_cursor: "p2" }
        : { items: PAGE_TWO, next_cursor: "" };
    if (path === "/v1/me/organizations") return { items: MINE, next_cursor: "" };
    if (path === "/v1/tenants/g") return { ...PAGE_ONE[0], deletion_due_at: null };
    if (path === "/v1/me/invites") return { items: [{ id: "i1" }] };
    throw new Error(`unexpected request: ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

function renderPage(filters: OrgFilters = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onFiltersChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <OrgsListPage filters={filters} onFiltersChange={onFiltersChange} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
  return { onFiltersChange };
}
const table = () => screen.getByRole("table", { name: "Organisations" });
const rowOf = (name: string) =>
  within(table()).getByRole("link", { name }).closest("tr") as HTMLElement;

describe("the Organisations list", () => {
  it("reads every page and shows your place in each", async () => {
    renderPage();
    expect(await within(table()).findByRole("link", { name: "Xeno" })).toBeTruthy();
    const group = within(rowOf("Qeet Group"));
    expect(group.getByText("Current")).toBeTruthy();
    expect(group.getByText("qeet.in")).toBeTruthy();
    expect(group.getByText("Admin")).toBeTruthy();
    expect(group.getByText("Enterprise")).toBeTruthy();
    expect(group.getByText("39%")).toBeTruthy();
    expect(group.getByText("Now")).toBeTruthy();
    expect(within(rowOf("Qeet Sandbox")).getByText("Owner")).toBeTruthy();
    expect(within(rowOf("Xeno")).getByText("Suspended")).toBeTruthy();
  });

  it("leads with the key numbers, each a filter", async () => {
    renderPage();
    await within(table()).findByRole("link", { name: "Xeno" });
    expect(screen.getByText("50")).toBeTruthy(); // 46 + 3 + 1 people
    expect(screen.getByText("38%")).toBeTruthy(); // 19 of 50 use two-step
    expect(
      screen.getByRole("link", { name: "2 organisations are below it" }).getAttribute("href"),
    ).toBe("/organizations?look=below-target");
    expect(screen.getByRole("link", { name: /Not opened in 30 days/ }).getAttribute("href")).toBe(
      "/organizations?look=stale",
    );
    expect(screen.getByRole("link", { name: /Invitations waiting/ }).getAttribute("href")).toBe(
      "/select-organization",
    );
  });

  it("switches into an organisation from its row, but not into the current or a suspended one", async () => {
    renderPage();
    await within(table()).findByRole("link", { name: "Xeno" });
    expect(within(rowOf("Qeet Group")).queryByRole("button", { name: /Switch/ })).toBeNull();
    expect(within(rowOf("Xeno")).queryByRole("button", { name: /Switch/ })).toBeNull();
    fireEvent.click(
      within(rowOf("Qeet Sandbox")).getByRole("button", { name: "Switch to Qeet Sandbox" }),
    );
    await waitFor(() => expect(switchToTenant).toHaveBeenCalledWith("s"));
  });

  it("offers no edit, suspend or delete on a row", async () => {
    renderPage();
    await within(table()).findByRole("link", { name: "Xeno" });
    for (const name of [/^Suspend/, /^Edit/, /^Delete/, /^Actions/])
      expect(within(table()).queryByRole("button", { name })).toBeNull();
  });

  it("lists only what the address asks for, and says when nothing matches", async () => {
    renderPage({ look: "below-target" });
    await within(table()).findByRole("link", { name: "Qeet Group" });
    expect(within(table()).queryByRole("link", { name: "Xeno" })).toBeNull();
    cleanup();
    const { onFiltersChange } = renderPage({ q: "nothing-like-this" });
    expect(await screen.findByText("No organisations match")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(onFiltersChange).toHaveBeenCalledWith({});
  });
});
