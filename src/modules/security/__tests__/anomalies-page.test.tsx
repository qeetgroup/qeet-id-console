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
  useLocation: () => ({ pathname: "/security/threats/anomalies", searchStr: "", hash: "" }),
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
import { AnomaliesPage } from "../components/threats/anomalies-page";

const now = Date.now();
const ago = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
const ANOMALIES = [
  {
    id: "an-1",
    type: "password_spraying",
    severity: "high",
    detail: "A network was blocked from password sign-in after failing against many accounts.",
    status: "rate-limited",
    ip: "198.51.100.252",
    metadata: {
      counter: "source",
      distinct_accounts: 31,
      window_minutes: 15,
      network: "198.51.100.252",
    },
    created_at: ago(2),
  },
  {
    id: "an-2",
    type: "credential_stuffing",
    severity: "high",
    detail: "Account temporarily locked after repeated failed sign-in attempts from one network.",
    status: "resolved",
    user_id: "u-ines",
    user_email: "ines@qeet.in",
    ip: "203.0.113.247",
    metadata: {
      counter: "account_network",
      failures: 5,
      window_minutes: 15,
      network: "203.0.113.247",
    },
    created_at: ago(30),
    resolved_at: ago(20),
  },
];

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/security/anomalies") return { items: ANOMALIES };
    if (path === "/v1/tenants/t-1/security/anomalies/summary")
      return { open: 1, resolved_24h: 1, affected_accounts: 0, high_severity_24h: 1 };
    if (path === "/v1/tenants/t-1/security/bots")
      return { recent: [], stats: { blocked_24h: 0, challenged_24h: 0, threshold: 0.7 } };
    if (path === "/v1/tenants/t-1/ip-rules") return { enabled: false, items: [] };
    if (path === "/v1/users/stats")
      return {
        total: 45,
        active: 44,
        suspended: 1,
        invited: 0,
        mfa_enabled: 18,
        mfa_missing: 27,
        new_last_30d: 0,
      };
    if (path === "/v1/tenants/t-1/security/anomalies/an-1/resolve" && method === "POST")
      return undefined;
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

describe("Threats › Anomalies", () => {
  it("says what the lockout counted, from the detection's own facts", async () => {
    renderWith(<AnomaliesPage filters={{}} onFiltersChange={vi.fn()} />);
    const table = await screen.findByRole("table", { name: "Anomalies" });
    await waitFor(() =>
      expect(
        within(table).getByText(
          "Failed sign-ins against 31 accounts from one network in 15 minutes",
        ),
      ).toBeTruthy(),
    );
    expect(
      within(table).getByText("5 failed sign-ins from one network in 15 minutes"),
    ).toBeTruthy();
    expect(within(table).getByText("31 accounts")).toBeTruthy();
  });

  it("opens an anomaly with what to do, and resolves it without a confirm", async () => {
    renderWith(<AnomaliesPage filters={{}} onFiltersChange={vi.fn()} />);
    const table = await screen.findByRole("table", { name: "Anomalies" });
    fireEvent.click(await within(table).findByRole("button", { name: /^Password spraying/ }));
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("What to do")).toBeTruthy();
    expect(await within(drawer).findByText(/18 of 45 people have it today/)).toBeTruthy();
    expect(within(drawer).getByText(/doesn't lift a lock/)).toBeTruthy();
    fireEvent.click(within(drawer).getByRole("button", { name: "Resolve" }));
    await waitFor(() =>
      expect(changes()).toEqual(["POST /v1/tenants/t-1/security/anomalies/an-1/resolve"]),
    );
    expect(sensitiveCalls.at(-1)?.confirm).toBeUndefined();
  });

  it("filters to the open ones in the address", async () => {
    renderWith(<AnomaliesPage filters={{ status: "open" }} onFiltersChange={vi.fn()} />);
    const table = await screen.findByRole("table", { name: "Anomalies" });
    await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(2));
    expect(within(table).queryByText("ines@qeet.in")).toBeNull();
  });
});
