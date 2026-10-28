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
  useLocation: () => ({ pathname: "/directory/connections", searchStr: "", hash: "" }),
  useNavigate: () => navigate,
  useSearch: () => ({}),
  Link: ({
    to,
    search,
    children,
    ...props
  }: ComponentProps<"a"> & {
    to: string;
    search?: Record<string, string>;
    children?: ReactNode;
  }) => {
    const query = search ? new URLSearchParams(search).toString() : "";
    return (
      <a {...props} href={query ? `${to}?${query}` : to}>
        {children}
      </a>
    );
  },
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { ConnectionsPage } from "../components/connections/connections-page";
import type { ConnectionsFilters } from "../connections-search";

const DAY = 86_400_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const record = (patch: Record<string, unknown>) => ({
  id: "st",
  name: "Staging Directory (test)",
  reference: "st",
  type: "ldap",
  status: "draft",
  health: "unknown",
  environment: null,
  scope: "users-on-signin",
  created_at: ago(20 * DAY),
  last_activity_at: null,
  last_sync_at: null,
  user_count: null,
  group_count: null,
  server_url: "ldaps://ldap.staging.qeet.in:636",
  ...patch,
});
const failure = {
  id: "e1",
  connection_id: "st",
  operation: "test",
  trigger: "manual",
  resource_type: "connection",
  resource_id: "",
  started_at: ago(8 * DAY),
  duration_ms: 14366,
  http_status: 502,
  status: "failed",
  users_synced: 0,
  groups_synced: 0,
  error_code: "DIR-502",
  message: "ldaps://ldap.staging.qeet.in:636: no such host",
  category: "connection",
  severity: "critical",
  resolution: "open",
  resolved_at: null,
  retry_of: null,
  retryable: true,
};
const page = (items: unknown[], extra: Record<string, unknown> = {}) => ({
  items,
  total: items.length,
  limit: 100,
  offset: 0,
  ...extra,
});
const state = vi.hoisted(() => ({ connections: [] as unknown[] }));

beforeEach(() => {
  granted.except = new Set();
  navigate.mockReset();
  state.connections = [record({})];
  vi.mocked(api).mockImplementation(async (path: string, options) => {
    const method = options?.method ?? "GET";
    const query = (options?.query ?? {}) as Record<string, unknown>;
    if (path === "/v1/tenants/t1/directory/connections") return { items: state.connections };
    if (path === "/v1/users/stats")
      return {
        total: 45,
        active: 44,
        suspended: 1,
        invited: 0,
        mfa_enabled: 18,
        mfa_missing: 27,
        new_last_30d: 1,
      };
    if (path === "/v1/tenants/t1/directory/activity")
      return page(query.status === "failed" ? [failure] : [], {
        summary: { total: 3, successful: 0, warnings: 0, failed: 3, average_duration_ms: 13000 },
        volume: [],
      });
    if (path === "/v1/tenants/t1/directory/errors")
      return page([failure], {
        summary: { open: 3, critical: 3, warning: 0, retried: 0, impacted_users: 0 },
        categories: [],
        connections: [],
        remediations: [],
      });
    if (method !== "GET") return method === "POST" ? { ok: true } : undefined;
    throw new Error(`unexpected request: ${method} ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

function renderPage(filters: ConnectionsFilters = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onFiltersChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <ConnectionsPage filters={filters} onFiltersChange={onFiltersChange} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
  return { onFiltersChange };
}
const table = () => screen.getByRole("table", { name: "Connections" });
const writes = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => `${options?.method} ${path}`);
async function chooseRowAction(name: string | RegExp) {
  const row = (await within(table()).findByText("Staging Directory (test)")).closest(
    "tr",
  ) as HTMLElement;
  fireEvent.click(within(row).getByRole("button", { name: /actions/i }));
  fireEvent.click(await screen.findByRole("menuitem", { name }));
}

describe("Directories › Connections", () => {
  it("says where people come from, and how each connection is", async () => {
    renderPage();
    const row = (await within(table()).findByText("Staging Directory (test)")).closest(
      "tr",
    ) as HTMLElement;
    expect(within(row).getByText("LDAP sign-in")).toBeTruthy();
    expect(within(row).getByText("Draft")).toBeTruthy();
    expect(within(row).getByText("Not checked")).toBeTruthy();
    expect(within(row).getByText(/^no such host · /)).toBeTruthy();
    expect(within(row).getByText("Never")).toBeTruthy();
    expect(await screen.findByText("of 45 people · 45 managed here")).toBeTruthy();
    expect(screen.getByText("LDAP, not counted yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open sync errors/ }).getAttribute("href")).toBe(
      "/directory/sync-errors",
    );
    expect(screen.getByRole("link", { name: /Drafts not turned on/ }).getAttribute("href")).toBe(
      "/directory/connections?show=draft",
    );
  });

  it("offers SCIM when it isn't set up, and opens its page", async () => {
    renderPage();
    const offers = await screen.findByRole("region", { name: "Not set up yet" });
    expect(within(offers).getByText("SCIM provisioning")).toBeTruthy();
    expect(
      within(offers)
        .getByRole("link", { name: /Set up SCIM/ })
        .getAttribute("href"),
    ).toBe("/directory/connections/scim");
    expect(within(offers).queryByText("LDAP or Active Directory")).toBeNull();
  });

  it("says SCIM is set up in Add connection once it is", async () => {
    state.connections = [
      record({
        id: "scim:t1",
        type: "scim",
        status: "configured",
        user_count: 1240,
        server_url: null,
      }),
    ];
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Add connection/ }));
    const scim = await screen.findByRole("menuitem", {
      name: "SCIM provisioning · already set up",
    });
    expect(scim.getAttribute("aria-disabled")).toBe("true");
  });

  it("tests a connection and says how it went", async () => {
    renderPage();
    await chooseRowAction("Test connection");
    await waitFor(() => expect(writes()).toEqual(["POST /v1/tenants/t1/ldap/st/test"]));
  });

  it("turns a draft on without a confirm, and an active one off only after one", async () => {
    renderPage();
    await chooseRowAction("Turn on");
    await waitFor(() => expect(writes()).toEqual(["PATCH /v1/tenants/t1/ldap/st"]));
    cleanup();
    vi.mocked(api).mockClear();
    state.connections = [record({ status: "active", health: "healthy" })];
    renderPage();
    await chooseRowAction("Turn off");
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(/can't sign in with their password from ldap\.staging\.qeet\.in/),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });

  it("deletes a connection only after the confirm, which says what happens to people", async () => {
    renderPage();
    await chooseRowAction(/^Delete/);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Delete Staging Directory (test)?")).toBeTruthy();
    expect(within(dialog).getByText(/accounts, groups and roles stay/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete connection" }));
    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/tenants/t1/ldap/st"]));
  });

  it("revokes the SCIM token only after the confirm", async () => {
    state.connections = [
      record({
        id: "scim:t1",
        name: "SCIM",
        type: "scim",
        status: "configured",
        user_count: 1240,
        server_url: null,
      }),
    ];
    renderPage();
    const row = (await within(table()).findByText("SCIM provisioning")).closest(
      "tr",
    ) as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: /actions/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Revoke token" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/The 1,240 people it created stay/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke token" }));
    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/tenants/t1/scim/token"]));
  });

  it("offers no changes to someone who can only look", async () => {
    granted.except = new Set(["connection.write"]);
    renderPage();
    await within(table()).findByText("Staging Directory (test)");
    expect(screen.queryByRole("button", { name: /Add connection/ })).toBeNull();
    expect(screen.getByText("You can see the connections, not change them")).toBeTruthy();
  });

  it("narrows to drafts from the address, and clears back", async () => {
    state.connections = [
      record({}),
      record({ id: "ad", name: "Corporate AD", status: "active", health: "healthy" }),
    ];
    const { onFiltersChange } = renderPage({ show: "draft" });
    await within(table()).findByText("Staging Directory (test)");
    expect(within(table()).queryByText("Corporate AD")).toBeNull();
    expect(screen.getByText("1 of 2 connections")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Remove filter/ }));
    expect(onFiltersChange).toHaveBeenCalledWith({});
  });
});
