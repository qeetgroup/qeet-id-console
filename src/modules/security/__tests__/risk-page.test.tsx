// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  useLocation: () => ({ pathname: "/security/threats/risk-settings", searchStr: "", hash: "" }),
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
import { RiskPage } from "../components/threats/risk-page";

const SETTINGS = {
  medium_threshold: 0.5,
  high_threshold: 0.8,
  force_mfa_at_level: "high",
  impossible_travel_enabled: false,
  min_travel_hours: 3,
  device_reputation_enabled: true,
};

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/security/risk-settings" && method === "GET") return SETTINGS;
    if (path === "/v1/tenants/t-1/security/risk-settings" && method === "PUT") return options?.body;
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

describe("Threats › Risk", () => {
  it("shows where each level starts and which must pass two-step verification", async () => {
    renderWith(<RiskPage />);
    expect(await screen.findByText("Below 0.50")).toBeTruthy();
    expect(screen.getByText("From 0.50 to under 0.80")).toBeTruthy();
    expect(screen.getByText("0.80 and above")).toBeTruthy();
    // 0.55 for an app that isn't a browser + 0.25 for a new device reaches high.
    expect(screen.getByText(/0\.55 \+ 0\.25 = 0\.80: high/)).toBeTruthy();
  });

  it("turns a signal on with the rest of the settings unchanged, as a sensitive action", async () => {
    renderWith(<RiskPage />);
    fireEvent.click(await screen.findByRole("switch", { name: "Impossible travel" }));
    await waitFor(() => expect(changes()).toEqual(["PUT /v1/tenants/t-1/security/risk-settings"]));
    const put = vi.mocked(api).mock.calls.find(([, o]) => o?.method === "PUT");
    expect(put?.[1]?.body).toEqual({ ...SETTINGS, impossible_travel_enabled: true });
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Change risk settings");
    expect(sensitiveCalls.at(-1)?.confirm).toBeUndefined();
  });
});
