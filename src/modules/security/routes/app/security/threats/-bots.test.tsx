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
import { Route } from "./bots";

const Page = Route.options.component as () => React.JSX.Element;

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (method === "GET" && path === "/v1/tenants/t-1/security/bots") {
      return { recent: [], stats: { blocked_24h: 0, challenged_24h: 0, threshold: 0.7 } };
    }
    if (path === "/v1/tenants/t-1/security/bots/settings" && ["GET", "PUT"].includes(method)) {
      return {
        ua_check: true,
        honeypot: false,
        captcha: false,
        signature: false,
        score_threshold: 0.7,
      };
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

describe("Security › Bot protection", () => {
  it("saves a detection rule as a sensitive action, without a confirmation", async () => {
    renderPage();
    // User-Agent fingerprinting is the first rule, on in the saved settings.
    await waitFor(() =>
      expect(screen.getAllByRole("switch")[0]?.getAttribute("aria-checked")).toBe("true"),
    );
    const [uaCheck] = screen.getAllByRole("switch");
    if (!uaCheck) throw new Error("Rule switch is missing");
    fireEvent.click(uaCheck);

    await waitFor(() => expect(changes()).toEqual(["PUT /v1/tenants/t-1/security/bots/settings"]));
    const put = vi.mocked(api).mock.calls.find(([, options]) => options?.method === "PUT");
    expect(put?.[1]?.body).toMatchObject({ ua_check: false });
    expect(sensitiveCalls[0]?.actionLabel).toBe("Change bot protection settings");
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});
