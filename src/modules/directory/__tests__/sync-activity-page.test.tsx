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
  useLocation: () => ({ pathname: "/directory/sync-activity", searchStr: "", hash: "" }),
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
import { DEFAULT_EVENT_FILTERS } from "../api/directory";
import { fetchActivityExport } from "../api/sync";
import { SyncActivityPage } from "../components/sync/activity-page";
import type { ActivityFilters } from "../sync-search";
import { check, page, push, record } from "./fixtures";

const summary = { total: 2, successful: 1, warnings: 0, failed: 1, average_duration_ms: 7000 };

beforeEach(() => {
  granted.except = new Set();
  navigate.mockReset();
  vi.mocked(api).mockImplementation(async (path: string, options) => {
    const method = options?.method ?? "GET";
    const query = (options?.query ?? {}) as Record<string, unknown>;
    if (path === "/v1/tenants/t1/directory/connections")
      return {
        items: [
          record(),
          record({
            id: "scim:t1",
            type: "scim",
            name: "SCIM",
            status: "configured",
            server_url: null,
          }),
        ],
      };
    if (path === "/v1/tenants/t1/directory/activity") {
      const items = query.status === "failed" ? [check()] : [push(), check()];
      return page(items, {
        total: items.length,
        summary: query.status === "failed" ? { ...summary, total: 1, successful: 0 } : summary,
        volume: [{ date: new Date().toISOString().slice(0, 10), users: 1, groups: 0 }],
      });
    }
    if (path === "/v1/tenants/t1/directory/errors")
      return page([check()], {
        summary: { open: 3, critical: 3, warning: 0, retried: 0, impacted_users: 0 },
        categories: [],
        connections: [],
        remediations: [],
      });
    if (method === "POST")
      return { id: "a1", name: "x", connection_id: null, threshold: 3, enabled: true };
    throw new Error(`unexpected request: ${method} ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

function renderPage(filters: ActivityFilters = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onFiltersChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <SyncActivityPage filters={filters} onFiltersChange={onFiltersChange} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
  return { onFiltersChange };
}
const table = () => screen.getByRole("table", { name: "Sync activity" });
const activityCalls = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([path]) => path === "/v1/tenants/t1/directory/activity")
    .map(([, options]) => options?.query as Record<string, unknown>);
const writes = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => ({ call: `${options?.method} ${path}`, body: options?.body }));

describe("Directories › Sync activity", () => {
  it("lists each run: what it was, what it changed and how it ended", async () => {
    renderPage();
    const failed = (await within(table()).findByText("Connection check")).closest(
      "tr",
    ) as HTMLElement;
    expect(within(failed).getByText(/Staging Directory \(test\) · Run by an admin/)).toBeTruthy();
    expect(within(failed).getByText("A check only")).toBeTruthy();
    expect(within(failed).getByText("Failed")).toBeTruthy();
    expect(within(failed).getByText("DIR-502")).toBeTruthy();
    const added = within(table()).getByText("Person added").closest("tr") as HTMLElement;
    expect(
      within(added).getByText(/SCIM provisioning · Sent by your identity provider/),
    ).toBeTruthy();
    expect(within(added).getByText("1 person")).toBeTruthy();
    expect(within(added).getByText("Succeeded")).toBeTruthy();
  });

  it("covers 30 days in its band, and narrows the list to the failures from it", async () => {
    renderPage();
    expect(await screen.findByText("events · 1 failed")).toBeTruthy();
    expect(screen.getAllByText("Last 30 days").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Show the 1 failed" }).getAttribute("href")).toBe(
      "/directory/sync-activity?result=failed",
    );
    expect(activityCalls().every((q) => q.days === 30)).toBe(true);
  });

  it("asks the server for the address's filters, and keeps the band on the period", async () => {
    renderPage({ period: "7d", result: "failed", connection: "st", q: "DIR-502" });
    await within(table()).findByText("Connection check");
    const queries = activityCalls();
    expect(queries).toContainEqual(
      expect.objectContaining({
        days: 7,
        status: "failed",
        connection_id: "st",
        q: "DIR-502",
        limit: 25,
      }),
    );
    // The band's reads: the period alone, its failures, and each connection's.
    expect(queries).toContainEqual({ ...DEFAULT_EVENT_FILTERS, days: 7, limit: 1 });
    expect(queries).toContainEqual({
      ...DEFAULT_EVENT_FILTERS,
      days: 7,
      connection_id: "st",
      limit: 1,
    });
  });

  it("opens a run's details, and leads a failure to Sync errors", async () => {
    renderPage();
    const row = (await within(table()).findByText("Connection check")).closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: /^Connection check/ }));
    const drawer = await screen.findByRole("dialog", { name: "Connection check" });
    expect(within(drawer).getByText("Couldn't connect")).toBeTruthy();
    expect(within(drawer).getByText("Open on Sync errors")).toBeTruthy();
    expect(
      within(drawer).getByText(
        "DIR-502 · HTTP 502 · ldaps://ldap.staging.qeet.in:636: no such host",
      ),
    ).toBeTruthy();
    fireEvent.click(within(drawer).getByRole("button", { name: /Open in Sync errors/ }));
    expect(navigate).toHaveBeenCalledWith({
      to: "/directory/sync-errors",
      search: { connection: "st" },
    });
  });

  it("makes an alert for the person asking, saying only they get it", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Alert me/ }));
    const dialog = await screen.findByRole("dialog", { name: "Alert me when directories fail" });
    expect(within(dialog).getByText("Only you get it, at most once every 15 minutes")).toBeTruthy();
    expect(within(dialog).getByText(/can't be changed or removed here yet/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /Create alert/ }));
    await waitFor(() =>
      expect(writes()).toEqual([
        {
          call: "POST /v1/tenants/t1/directory/alerts",
          body: { name: "Directory failures", connection_id: null, threshold: 3 },
        },
      ]),
    );
  });

  it("offers no alert to someone who can only look", async () => {
    granted.except = new Set(["connection.write"]);
    renderPage();
    await within(table()).findByText("Connection check");
    expect(screen.queryByRole("button", { name: /Alert me/ })).toBeNull();
  });

  it("exports every page on the list's filters, not just the rows on show", async () => {
    const first = page([push()], { total: 2, summary, volume: [] });
    vi.mocked(api).mockReset();
    vi.mocked(api)
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce({ ...first, items: [push({ id: "p2" })] });
    const records = await fetchActivityExport("t1", DEFAULT_EVENT_FILTERS);
    expect(records.map((e) => e.id)).toEqual(["p1", "p2"]);
    expect(api).toHaveBeenLastCalledWith(
      "/v1/tenants/t1/directory/activity",
      expect.objectContaining({ query: { ...DEFAULT_EVENT_FILTERS, limit: 100, offset: 100 } }),
    );
  });
});
