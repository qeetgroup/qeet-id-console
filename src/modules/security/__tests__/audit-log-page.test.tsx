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
  useTenantId: () => "t-1",
  useUserId: () => "u-me",
  useSessionId: () => "s-1",
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", mode: "full", can: () => true, canAll: () => true }),
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/security/audit-logs", searchStr: "", hash: "" }),
  useNavigate: () => vi.fn(),
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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Records what each sensitive action asked for, then runs it through the real provider.
const sensitiveCalls = vi.hoisted(
  () => [] as { actionLabel?: string; confirm?: { description?: string } }[],
);
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return (options: Parameters<typeof run>[0]) => {
        sensitiveCalls.push(options);
        return run(options);
      };
    },
  };
});

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { AuditLogPage } from "../components/audit/audit-log-page";
import type { AuditSearch } from "../audit-model";

vi.mock("@/modules/billing", () => ({
  useEntitlements: () => ({ data: { features: { audit_export: true } } }),
}));

const EVENT = {
  id: "ev-1",
  tenant_id: "t-1",
  actor_user_id: "u-priya",
  actor_type: "user",
  action: "auth.sign_in_failed",
  resource_type: "user",
  resource_id: "u-priya",
  ip: "203.0.113.12",
  user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/155.0",
  request_id: "req-1",
  created_at: new Date(Date.now() - 3_600_000).toISOString(),
};

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/audit") return { items: [EVENT], next_cursor: "" };
    if (path === "/v1/tenants/t-1/audit/anomalies") return { items: [] };
    if (path === "/v1/tenants/t-1/audit/anomalies/summary")
      return { open: 0, resolved_7d: 0, high_score_open: 0 };
    if (path === "/v1/tenants/t-1/audit/anomaly-settings" && method === "GET")
      return { tenant_id: "t-1", enabled: true, score_threshold: 0.6, min_baseline_events: 20 };
    if (path === "/v1/tenants/t-1/audit/anomaly-settings" && method === "PUT") return options?.body;
    if (path === "/v1/tenants/t-1/log-sinks") return { items: [] };
    if (path === "/v1/activity/summary")
      return {
        total: 12,
        unique_actors: 3,
        security_alerts: 0,
        by_severity: {},
        by_category: {},
        by_outcome: { failed: 2 },
        series: [],
        bucket_seconds: 1800,
        window: { from: "", to: "" },
      };
    if (path === "/v1/activity/ev-1/related")
      return {
        event: {
          id: "ev-1",
          type: "auth.sign_in_failed",
          category: "authentication",
          severity: "error",
          title: "",
          at: EVENT.created_at,
          metadata: { reason: "invalid_password" },
        },
        related: { by_request_id: [], by_actor: [] },
      };
    if (path === "/v1/users")
      return {
        items: [
          {
            id: "u-priya",
            email: "priya@qeet.in",
            display_name: "Priya Nair",
            status: "active",
            tenant_id: "t-1",
            created_at: "",
          },
        ],
      };
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});
afterEach(cleanup);

function renderWith(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>{node}</SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

const changes = () =>
  vi
    .mocked(api)
    .mock.calls.map(([path, options]) => `${options?.method ?? "GET"} ${path}`)
    .filter((r) => !r.startsWith("GET "));

describe("Monitoring › Audit log", () => {
  it("names the actor and the event, with its outcome", async () => {
    renderWith(<AuditLogPage search={{}} onSearchChange={vi.fn()} />);
    const table = await screen.findByRole("table", { name: "Audit events" });
    await waitFor(() => expect(within(table).getAllByText("Priya Nair").length).toBeGreaterThan(0));
    expect(within(table).getByText("auth.sign_in_failed")).toBeTruthy();
    expect(within(table).getByText("Failed")).toBeTruthy();
  });

  it("opens an event from the address, with the details only the Activity API has", async () => {
    const search: AuditSearch = { event: "ev-1" };
    renderWith(<AuditLogPage search={search} onSearchChange={vi.fn()} />);
    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText("Details Qeet ID recorded")).toBeTruthy();
    expect(within(drawer).getByText("invalid_password")).toBeTruthy();
    expect(within(drawer).getByText("No other event shares its request ID.")).toBeTruthy();
  });

  it("puts a filter in the address and a person's events one click from their event", async () => {
    const onSearchChange = vi.fn();
    renderWith(<AuditLogPage search={{ event: "ev-1" }} onSearchChange={onSearchChange} />);
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(await within(drawer).findByRole("button", { name: "Events by Priya" }));
    expect(onSearchChange).toHaveBeenCalledWith({ actor_user_id: "u-priya" }, { replace: false });
  });

  it("saves the flagging settings as a sensitive action, from the Flagged view", async () => {
    renderWith(<AuditLogPage search={{ view: "flagged" }} onSearchChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Detection settings" }));
    const drawer = await screen.findByRole("dialog");
    const threshold = await within(drawer).findByRole("textbox", { name: "Flag at a score of" });
    fireEvent.change(threshold, { target: { value: "0.8" } });
    fireEvent.blur(threshold);
    fireEvent.click(within(drawer).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(changes()).toEqual(["PUT /v1/tenants/t-1/audit/anomaly-settings"]));
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Change flagging settings");
  });
});
