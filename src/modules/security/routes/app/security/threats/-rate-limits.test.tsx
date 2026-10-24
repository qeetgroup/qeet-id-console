// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import { Route } from "./rate-limits";

const RateLimitsPage = Route.options.component as () => React.JSX.Element;

const LIMITS = {
  tenant: { rate: 100, capacity: 500 },
  user: { rate: 30, capacity: 100 },
  api_key: { rate: 50, capacity: 200 },
};

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/rate-limits") {
      if (method === "GET" || method === "PUT") return LIMITS;
      if (method === "DELETE") return undefined;
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
        <RateLimitsPage />
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

async function openResetConfirmation(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole("button", { name: "Reset to defaults" }));
  const cancel = await screen.findByRole("button", { name: "Cancel" });
  const dialog = cancel.closest('[role="alertdialog"], [role="dialog"]');
  if (!dialog) throw new Error("Confirmation dialog is missing");
  return dialog as HTMLElement;
}

describe("Security › Rate limits", () => {
  it("confirms before resetting every limit to the platform defaults", async () => {
    renderPage();
    const dialog = await openResetConfirmation();

    expect(within(dialog).getByText("Reset all rate limits to platform defaults?")).toBeTruthy();
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Reset rate limits to platform defaults");
    expect(changes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Reset to defaults" }));
    await waitFor(() => expect(changes()).toEqual(["DELETE /v1/tenants/t-1/rate-limits"]));
  });

  it("keeps the limits when the reset is cancelled", async () => {
    renderPage();
    const dialog = await openResetConfirmation();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull());
    expect(changes()).toEqual([]);
  });

  it("saves changed limits as a sensitive action, without a confirmation", async () => {
    renderPage();
    const [tenantRate] = await screen.findAllByLabelText("Rate (req/s)");
    if (!tenantRate) throw new Error("Rate field is missing");
    fireEvent.change(tenantRate, { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(changes()).toEqual(["PUT /v1/tenants/t-1/rate-limits"]));
    expect(sensitiveCalls[0]?.actionLabel).toBe("Change rate limits");
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});
