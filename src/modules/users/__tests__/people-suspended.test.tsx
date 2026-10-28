// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { toast } from "sonner";
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
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", mode: "full", can: () => true, canAll: () => true }),
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/users", searchStr: "", hash: "" }),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
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
vi.mock("@/modules/organizations", () => ({
  useOrgs: () => ({ data: { items: [{ id: "t1", name: "Qeet Group" }] } }),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { UsersPage } from "../pages";
import type { PeopleFilters } from "../people-model";

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const suspended = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  email: `${id}@qeet.in`,
  display_name: id,
  avatar_url: null,
  team: "",
  reason: "offboarding",
  source: "manual",
  risk: "low",
  review: "reviewed",
  suspended_at: ago(25),
  last_sign_in: null,
  can_manage: true,
  ...overrides,
});
const PAGE = {
  items: [
    suspended("Sowmya"),
    suspended("Rahul", {
      reason: "suspicious_activity",
      source: "policy",
      risk: "high",
      review: "pending",
      can_manage: false,
    }),
  ],
  total: 2,
  limit: 50,
  offset: 0,
  summary: { total: 2, high_risk: 1, policy: 1, manual: 1, pending: 1 },
  reasons: [
    { key: "offboarding", count: 1 },
    { key: "suspicious_activity", count: 1 },
  ],
  risks: [
    { key: "low", count: 1 },
    { key: "high", count: 1 },
  ],
  queue: [],
  teams: [],
};

beforeEach(() => {
  vi.spyOn(toast, "success").mockImplementation(() => "");
  vi.mocked(api).mockImplementation(async (path: string, opts?: { method?: string }) => {
    const method = opts?.method ?? "GET";
    if (method === "GET") {
      if (path === "/v1/users/suspended") return PAGE;
      if (path === "/v1/users") return { items: [] };
      if (path === "/v1/users/stats")
        return {
          total: 45,
          active: 43,
          suspended: 2,
          invited: 0,
          mfa_enabled: 18,
          mfa_missing: 27,
          new_last_30d: 1,
        };
      if (path === "/v1/tenants/t1/invites") return { items: [] };
    }
    if (path.endsWith("/suspension") && method === "PUT") return undefined;
    if (path.endsWith("/reactivate") && method === "POST") return undefined;
    throw new Error(`unexpected request: ${method} ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(api).mockReset();
});

function renderPage(filters: PeopleFilters = { status: "suspended" }, onFiltersChange = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <UsersPage filters={filters} onFiltersChange={onFiltersChange} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
  return { onFiltersChange };
}
const writes = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([, o]) => (o as { method?: string } | undefined)?.method)
    .map(([p, o]) => `${(o as { method: string }).method} ${p}`);
async function rowOf(name: string) {
  const table = await screen.findByRole("table", { name: "Suspended people" });
  return (await within(table).findByText(name)).closest("tr") as HTMLElement;
}

describe("All users, filtered to Suspended", () => {
  it("asks the suspended list, with the address's search and filters", async () => {
    renderPage({
      status: "suspended",
      q: "row",
      reason: "offboarding",
      risk: "low",
      review: "reviewed",
    });
    await rowOf("Sowmya");
    const query = vi.mocked(api).mock.calls.find(([p]) => p === "/v1/users/suspended")?.[1]?.query;
    expect(query).toMatchObject({
      q: "row",
      reason: "offboarding",
      risk: "low",
      review: "reviewed",
      limit: 50,
      offset: 0,
    });
  });

  it("shows why, how risky, since when and the review, for each person", async () => {
    renderPage();
    const rahul = await rowOf("Rahul");
    expect(within(rahul).getByText("Suspicious activity")).toBeTruthy();
    expect(within(rahul).getByText("By a policy")).toBeTruthy();
    expect(within(rahul).getByText("High risk")).toBeTruthy();
    expect(within(rahul).getByText("Waiting")).toBeTruthy();
    const sowmya = await rowOf("Sowmya");
    expect(within(sowmya).getByText("Offboarding")).toBeTruthy();
    expect(within(sowmya).getByText("Reviewed")).toBeTruthy();
    expect(screen.getByText("2 suspended · 1 by an admin, 1 by a policy")).toBeTruthy();
  });

  it("saves a review with the reason, risk and reviewed state chosen", async () => {
    renderPage();
    fireEvent.click(
      within(await rowOf("Sowmya"))
        .getAllByRole("button")
        .at(-1) as HTMLElement,
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Review the suspension…" }));
    const dialog = await screen.findByRole("dialog", { name: "Review Sowmya's suspension" });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Mark as reviewed/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save review" }));
    await waitFor(() => expect(writes()).toEqual(["PUT /v1/users/Sowmya/suspension"]));
    const body = vi
      .mocked(api)
      .mock.calls.find(([p]) => p === "/v1/users/Sowmya/suspension")?.[1]?.body;
    expect(body).toEqual({ reason: "offboarding", risk: "low", review: "pending" });
  });

  it("reactivates the selection, leaving out anyone the admin can't manage", async () => {
    renderPage();
    fireEvent.click(within(await rowOf("Sowmya")).getByRole("checkbox"));
    fireEvent.click(within(await rowOf("Rahul")).getByRole("checkbox"));
    fireEvent.click(await screen.findByRole("button", { name: "Reactivate (2)" }));
    await waitFor(() => expect(writes()).toEqual(["POST /v1/users/Sowmya/reactivate"]));
  });

  it("can't review or reactivate someone the admin can't manage", async () => {
    renderPage();
    fireEvent.click(
      within(await rowOf("Rahul"))
        .getAllByRole("button")
        .at(-1) as HTMLElement,
    );
    expect(
      (await screen.findByRole("menuitem", { name: "Reactivate" })).getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      screen
        .getByRole("menuitem", { name: "Review the suspension…" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("clears the suspension filters when the status filter is removed", async () => {
    const { onFiltersChange } = renderPage({ status: "suspended", risk: "high", q: "ra" });
    fireEvent.click(await screen.findByRole("button", { name: /Remove.*Status/ }));
    expect(onFiltersChange).toHaveBeenCalledWith({
      q: "ra",
      status: undefined,
      risk: undefined,
      reason: undefined,
      review: undefined,
    });
  });
});
