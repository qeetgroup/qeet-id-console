// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
vi.mock("@/platform/components/page-header", () => ({ PageHeader: () => null }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import { api } from "@/platform/api/client";
import { Route } from "./security-policy";

const SecurityPolicyPage = Route.options.component as () => React.JSX.Element;

const policy = {
  tenant_id: "t-1",
  password_min_length: 12,
  password_complexity: "standard",
  session_max_age: "720h",
  session_idle_timeout: "24h",
  max_sessions: null,
  session_limit_action: "evict_oldest",
  mfa_enforcement: "optional",
  mfa_grace_days: 0,
  step_up_window: "5m",
  step_up_methods: null,
};

beforeEach(() => {
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/tenants/t-1/policy") return options?.method === "PUT" ? options.body : policy;
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
});
afterEach(cleanup);

describe("Security policy — address rules are the one place for networks", () => {
  it("has no IP lists of its own, points at IP rules, and saves without them", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SecurityPolicyPage />
      </QueryClientProvider>,
    );

    const link = await screen.findByRole("link", { name: "Open IP rules" });
    expect(link.getAttribute("href")).toBe("/security/threats/ip-allowlist");
    expect(screen.queryByLabelText(/IP allowlist/i)).toBeNull();
    expect(screen.queryByLabelText(/IP denylist/i)).toBeNull();

    fireEvent.submit(link.closest("form") as HTMLFormElement);
    await waitFor(() =>
      expect(vi.mocked(api).mock.calls.some(([, o]) => o?.method === "PUT")).toBe(true),
    );
    const put = vi.mocked(api).mock.calls.find(([, o]) => o?.method === "PUT");
    const body = put?.[1]?.body as Record<string, unknown>;
    expect(body).not.toHaveProperty("ip_allowlist");
    expect(body).not.toHaveProperty("ip_denylist");
  });
});
