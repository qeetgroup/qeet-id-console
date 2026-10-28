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
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/directory/sync-errors", searchStr: "", hash: "" }),
  useNavigate: () => navigate,
  useSearch: () => ({}),
  Link: ({
    to,
    search,
    params: _params,
    replace: _replace,
    children,
    ...props
  }: ComponentProps<"a"> & {
    to: string;
    search?: Record<string, string>;
    params?: unknown;
    replace?: boolean;
    children?: ReactNode;
  }) => {
    const query = search
      ? new URLSearchParams(
          Object.entries(search).filter((e): e is [string, string] => e[1] !== undefined),
        ).toString()
      : "";
    return (
      <a {...props} href={query ? `${to}?${query}` : to}>
        {children}
      </a>
    );
  },
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { SyncErrorsPage } from "../components/sync/errors-page";
import type { ErrorsFilters } from "../sync-search";
import { ago, check, page, push, record } from "./fixtures";

const DAY = 86_400_000;
// The seeded Qeet Group: three failed checks of a draft LDAP connection whose host doesn't resolve.
const checks = [
  check({ id: "e3", started_at: ago(6 * DAY) }),
  check({ id: "e2", started_at: ago(20 * DAY) }),
  check({ id: "e1", started_at: ago(20 * DAY + 60_000) }),
];
const scimFailure = push({
  id: "s1",
  status: "failed",
  http_status: 409,
  error_code: "DIR-409",
  message: "An identity or group already exists",
  category: "provisioning",
  severity: "warning",
  resource_id: "",
});
const state = vi.hoisted(() => ({
  errors: [] as unknown[],
  connection: {} as Record<string, unknown>,
}));

beforeEach(() => {
  granted.except = new Set();
  navigate.mockReset();
  state.errors = checks;
  state.connection = {};
  vi.mocked(api).mockImplementation(async (path: string, options) => {
    const method = options?.method ?? "GET";
    const query = (options?.query ?? {}) as Record<string, unknown>;
    if (path === "/v1/tenants/t1/directory/connections")
      return { items: [record(state.connection)] };
    if (path === "/v1/tenants/t1/directory/errors") {
      const items = (state.errors as { resolution: string }[]).filter(
        (e) => !query.resolution || e.resolution === query.resolution,
      );
      return page(items, {
        summary: {
          open: items.length,
          critical: 3,
          warning: items.length - 3,
          retried: 0,
          impacted_users: 0,
        },
        categories: [],
        connections: [],
        remediations: [],
      });
    }
    if (method === "POST") return { succeeded: true };
    throw new Error(`unexpected request: ${method} ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

function renderPage(filters: ErrorsFilters = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onFiltersChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <SyncErrorsPage filters={filters} onFiltersChange={onFiltersChange} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
  return { onFiltersChange };
}
const writes = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => `${options?.method} ${path}`);
const problem = async () =>
  (await screen.findByText("Qeet ID can't connect to Staging Directory (test)")).closest(
    "li",
  ) as HTMLElement;

describe("Directories › Sync errors", () => {
  it("leads with the problem: what happened, to whom, what to do, and the admin's line", async () => {
    renderPage();
    const p = await problem();
    expect(
      within(p).getByText(/^Failed 3 times since .*, most recently 6 days ago\./),
    ).toBeTruthy();
    expect(within(p).getByText(/No one is affected yet: it's a draft\./)).toBeTruthy();
    const steps = within(p)
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(steps[0]).toMatch(
      /^Check the address\. Qeet ID tried ldaps:\/\/ldap\.staging\.qeet\.in:636\./,
    );
    expect(steps[1]).toMatch(/firewall to Qeet ID on port 636/);
    expect(
      within(p).getByText("ldaps://ldap.staging.qeet.in:636", { selector: "code" }),
    ).toBeTruthy();
    expect(
      within(p).getByText("DIR-502 · HTTP 502 · ldaps://ldap.staging.qeet.in:636: no such host"),
    ).toBeTruthy();
    expect(
      within(p)
        .getByRole("link", { name: /Edit connection/ })
        .getAttribute("href"),
    ).toBe("/directory/connections/ldap");
    expect(screen.getByText("1 problem")).toBeTruthy();
  });

  it("checks the newest failure again, and says so once it passes", async () => {
    renderPage();
    fireEvent.click(within(await problem()).getByRole("button", { name: /Check again/ }));
    await waitFor(() =>
      expect(writes()).toEqual(["POST /v1/tenants/t1/directory/errors/e3/retry"]),
    );
    expect(
      await screen.findByText(/^The check passed\. These failures are from before it/),
    ).toBeTruthy();
  });

  it("marks a problem's failures resolved only after the confirm", async () => {
    renderPage();
    fireEvent.click(within(await problem()).getByRole("button", { name: "Mark resolved" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Mark 3 failures resolved?")).toBeTruthy();
    expect(within(dialog).getByText(/Nothing changes on the connection/)).toBeTruthy();
    expect(writes()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark resolved" }));
    await waitFor(() =>
      expect(writes()).toEqual([
        "POST /v1/tenants/t1/directory/errors/e3/resolve",
        "POST /v1/tenants/t1/directory/errors/e2/resolve",
        "POST /v1/tenants/t1/directory/errors/e1/resolve",
      ]),
    );
  });

  it("says a connection that passed its check since needs its failures marked resolved", async () => {
    state.connection = { status: "active", health: "healthy" };
    renderPage();
    const p = await problem();
    expect(
      within(p).getByText(/^It works again: its latest run in the last 24 hours succeeded/),
    ).toBeTruthy();
    expect(within(p).queryByRole("button", { name: /Check again/ })).toBeNull();
  });

  it("offers no check for a SCIM failure, and says it's sent again from its source", async () => {
    state.errors = [scimFailure];
    renderPage();
    const table = screen.getByRole("table", { name: "Every failure" });
    const row = (await within(table).findByText("Already taken")).closest("tr") as HTMLElement;
    expect(within(row).getByText("A new person")).toBeTruthy();
    fireEvent.click(within(row).getByRole("button", { name: /^Already taken/ }));
    const drawer = await screen.findByRole("dialog", { name: "Already taken" });
    expect(within(drawer).getByText(/Qeet ID can't send this again/)).toBeTruthy();
    expect(within(drawer).queryByRole("button", { name: /Check again/ })).toBeNull();
    expect(within(drawer).getByRole("button", { name: "Mark resolved" })).toBeTruthy();
  });

  it("asks the server for the address's filters over the period", async () => {
    renderPage({ period: "7d", status: "open", severity: "critical", connection: "st", q: "502" });
    await problem();
    const queries = vi
      .mocked(api)
      .mock.calls.filter(([path]) => path === "/v1/tenants/t1/directory/errors")
      .map(([, options]) => options?.query);
    expect(queries).toContainEqual(
      expect.objectContaining({
        days: 7,
        resolution: "open",
        severity: "critical",
        connection_id: "st",
        q: "502",
      }),
    );
    // Open problems whatever their age: the 90 days the server keeps.
    expect(queries).toContainEqual(
      expect.objectContaining({ days: 90, resolution: "open", limit: 100 }),
    );
  });

  it("offers no changes to someone who can only look", async () => {
    granted.except = new Set(["connection.write"]);
    renderPage();
    const p = await problem();
    expect(within(p).queryByRole("button", { name: /Check again/ })).toBeNull();
    expect(within(p).queryByRole("button", { name: "Mark resolved" })).toBeNull();
    expect(within(p).getByRole("link", { name: "Open connection" })).toBeTruthy();
    expect(screen.getByText("You can see the failures, not change them")).toBeTruthy();
  });
});
