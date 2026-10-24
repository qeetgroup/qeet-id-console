// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
vi.mock("@/platform/components/page-header", () => ({
  PageHeader: ({ actions }: { actions?: ReactNode }) => actions ?? null,
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Records what each sensitive action asked for, then runs it through the real provider.
const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);
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
import { Route } from "./audit-intelligence";

const Page = Route.options.component as () => React.JSX.Element;

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (method === "GET" && path === "/v1/tenants/t-1/audit/anomalies") return { items: [] };
    if (method === "GET" && path === "/v1/tenants/t-1/audit/anomalies/summary") {
      return { open: 0, resolved_7d: 0, high_score_open: 0 };
    }
    if (path === "/v1/tenants/t-1/audit/anomaly-settings" && ["GET", "PUT"].includes(method)) {
      return { tenant_id: "t-1", enabled: true, score_threshold: 0.6, min_baseline_events: 20 };
    }
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});
afterEach(cleanup);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <Page />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function changes() {
  return vi
    .mocked(api)
    .mock.calls.map(([path, options]) => `${options?.method ?? "GET"} ${path}`)
    .filter((r) => !r.startsWith("GET "));
}

describe("Security › Audit intelligence › detection settings", () => {
  it("saves the settings as a sensitive action, without a confirmation", async () => {
    renderPage();
    // Save stays off until something changes.
    const save = (await screen.findByRole("button", { name: "Save" })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Score threshold"), { target: { value: "0.7" } });
    fireEvent.click(save);

    await waitFor(() => expect(changes()).toEqual(["PUT /v1/tenants/t-1/audit/anomaly-settings"]));
    expect(sensitiveCalls[0]?.actionLabel).toBe("Change anomaly detection settings");
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});
