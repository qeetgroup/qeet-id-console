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
vi.mock("@/modules/billing", () => ({
  useEntitlements: () => ({ data: { features: { audit_export: true } } }),
}));
// The stream isn't opened in tests; the page only uses it to read again sooner.
vi.mock("../activity-subscription", () => ({
  acquireSubscription: () => () => {},
  restartStream: () => {},
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/activity", searchStr: "", hash: "" }),
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
    params?: Record<string, string>;
    search?: unknown;
    children?: ReactNode;
  }) => {
    const path = Object.entries(params ?? {}).reduce((p, [k, v]) => p.replace(`$${k}`, v), to);
    const query =
      search && typeof search === "object"
        ? new URLSearchParams(search as Record<string, string>).toString()
        : "";
    return (
      <a {...props} href={query ? `${path}?${query}` : path}>
        {children}
      </a>
    );
  },
}));

import { api } from "@/platform/api/client";
import type { ActivitySearch } from "../activity-search";
import { ActivityPage } from "../components/list/activity-page";
import type { ActivityEvent, ActivitySummary } from "../types/activity.types";

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const event = (id: string, type: string, patch: Partial<ActivityEvent> = {}): ActivityEvent => ({
  id,
  type,
  category: "authentication",
  severity: "success",
  title: type,
  actor: { id: "u-priya", name: "Priya Nair", type: "user" },
  target: { type: "session", id: "5e55a0000000" },
  at: ago(5),
  ip: "203.0.113.10",
  browser: "Chrome",
  ...patch,
});
const EVENTS = [
  event("e1", "auth.login_succeeded", { at: ago(1) }),
  event("e2", "auth.token_reuse_detected", {
    severity: "critical",
    at: ago(30),
    actor: { id: "u-mareedu", name: "Mareedu Saibabu", type: "system" },
    request_id: "req-1",
    metadata: { reason: "refresh_token_reuse", refresh_token_id: "rt-1", ip: "203.0.113.10" },
  }),
  event("e3", "auth.sign_in_failed", { severity: "error", at: ago(60) }),
];
const SUMMARY: ActivitySummary = {
  total: 197,
  unique_actors: 34,
  security_alerts: 1,
  by_severity: { critical: 1, error: 56, info: 44, success: 95, warning: 1 },
  by_category: {
    authentication: 193,
    authorization: 0,
    developer: 1,
    directory: 1,
    security: 2,
    system: 0,
  },
  by_outcome: { failed: 57, info: 44, success: 95, warning: 1 },
  series: [],
  bucket_seconds: 1800,
  window: { from: ago(24 * 60), to: ago(0) },
};

beforeEach(() => {
  vi.mocked(api).mockImplementation(async (path: string) => {
    if (path === "/v1/activity") return { events: EVENTS };
    if (path === "/v1/activity/summary") return SUMMARY;
    if (path === "/v1/tenants") return { items: [{ id: "g", name: "Qeet Group" }] };
    const related = path.match(/^\/v1\/activity\/([^/]+)\/related$/);
    if (related) {
      const anchor = EVENTS.find((e) => e.id === related[1]);
      if (!anchor) throw Object.assign(new Error("not found"), { status: 404 });
      return {
        event: anchor,
        related: { by_request_id: [], by_actor: [EVENTS[2]] },
      };
    }
    throw new Error(`unexpected request: ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

function renderPage(search: ActivitySearch = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSearchChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <ActivityPage search={search} onSearchChange={onSearchChange} />
    </QueryClientProvider>,
  );
  /** The search the page asked for, from the last update it sent, applied to `prev`. */
  const lastSearch = (prev: ActivitySearch = search) => {
    const calls = onSearchChange.mock.calls;
    const update = calls[calls.length - 1]?.[0] as (p: ActivitySearch) => ActivitySearch;
    return update(prev);
  };
  return { onSearchChange, lastSearch };
}

describe("ActivityPage", () => {
  it("lists the log in words, with the server's counts in the band and on the tabs", async () => {
    renderPage();
    await screen.findByText("Successful sign-in");
    const table = screen.getByRole("table", { name: "Activity events" });
    expect(within(table).getByText("Refresh token reused")).toBeTruthy();
    // Qeet ID recorded the reuse, for Mareedu: the actor reads that way.
    expect(within(table).getByText("for Mareedu Saibabu")).toBeTruthy();
    expect(within(table).getAllByText("Critical").length).toBeGreaterThan(0);

    // The band's total and the All events tab's count.
    expect(screen.getAllByText("197")).toHaveLength(2);
    expect(screen.getByText("By 34 people")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Failed/ }).textContent).toContain("57");
    // Live: the header says how fresh it is.
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText(/New events show within 10 seconds\./)).toBeTruthy();
  });

  it("asks the server for the minimum severity a tab needs", async () => {
    const { onSearchChange, lastSearch } = renderPage();
    await screen.findByText("Successful sign-in");
    fireEvent.click(screen.getByRole("tab", { name: /Failed/ }));
    expect(onSearchChange).toHaveBeenCalled();
    expect(lastSearch().severity).toBe("error,critical");
  });

  it("isn't live for a range that has ended", async () => {
    renderPage({
      range: "custom",
      from: "2026-01-10T00:00:00.000Z",
      to: "2026-01-10T23:59:59.999Z",
    });
    // The list keeps to the range: nothing from today shows in January's.
    await screen.findByText("No events in this range");
    expect(screen.queryByText("Live")).toBeNull();
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
  });

  it("opens a row's event in the address", async () => {
    const { lastSearch } = renderPage();
    await screen.findByText("Refresh token reused");
    const [open] = screen.getAllByRole("button", { name: /^Refresh token reused/ });
    if (!open) throw new Error("no row button");
    fireEvent.click(open);
    expect(lastSearch().event).toBe("e2");
  });

  it("opens an event from a link, with its facts, details and the actor's events", async () => {
    const { lastSearch } = renderPage({ event: "e2" });
    const drawer = await screen.findByRole("dialog");
    await within(drawer).findByText("Details Qeet ID recorded");
    expect(within(drawer).getByRole("heading", { name: "Refresh token reused" })).toBeTruthy();
    expect(within(drawer).getByText("Qeet ID, for Mareedu Saibabu")).toBeTruthy();
    expect(within(drawer).getByText("auth.token_reuse_detected")).toBeTruthy();
    // The details leave out what the facts say already (the address).
    expect(within(drawer).getByText("Refresh token ID")).toBeTruthy();
    expect(within(drawer).queryByText("IP")).toBeNull();
    expect(within(drawer).getByText("By Mareedu, within 5 minutes")).toBeTruthy();

    fireEvent.click(within(drawer).getByRole("button", { name: "Events by Mareedu" }));
    expect(lastSearch()).toMatchObject({ actor: "u-mareedu" });
    expect(lastSearch().event).toBeUndefined();
  });

  it("says so when the event isn't in this organisation", async () => {
    renderPage({ event: "missing" });
    const drawer = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(within(drawer).getByText("No such event in this organisation")).toBeTruthy(),
    );
  });
});
