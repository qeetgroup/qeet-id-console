// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
vi.mock("@/modules/dashboard", () => ({ PageBreadcrumb: () => null }));
vi.mock("@/modules/users", () => ({
  useUserStats: () => ({ data: { total: 45, mfa_enabled: 18 } }),
}));
vi.mock("@/modules/authentication", () => ({
  useAuthPolicy: () => ({
    data: {
      password_enabled: true,
      password_min_length: 12,
      password_require_uppercase: true,
      password_require_number: true,
      password_require_symbol: false,
    },
  }),
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
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
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a {...props} href={to} />,
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
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
  mfa_enforced_since: null,
  step_up_window: "10m",
  step_up_methods: null,
  settings: {},
};

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/tenants/t-1/policy") return options?.method === "PUT" ? options.body : policy;
    if (path === "/v1/tenants/t-1") return { id: "t-1", name: "Acme" };
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
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
        <SecurityPolicyPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

const puts = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([, options]) => options?.method === "PUT")
    .map(([, options]) => options?.body as Record<string, unknown>);

describe("Settings › Security", () => {
  it("shows each rule as the server holds it, and links out for passwords and networks", async () => {
    renderPage();
    expect(await screen.findByText("No one: only people who set one up")).toBeTruthy();
    expect(screen.getByText("18 of 45 people have set one up.")).toBeTruthy();
    expect(screen.getByText("30 days")).toBeTruthy();
    expect(screen.getByText("1 day")).toBeTruthy();
    expect(screen.getByText("10 minutes")).toBeTruthy();
    expect(screen.getByText("All 5")).toBeTruthy();
    // The enforced password rules are Sign-in › Password's; /policy's own are never shown.
    expect(
      screen.getByText("At least 12 characters, with an upper-case letter and a number"),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open password rules" }).getAttribute("href")).toBe(
      "/auth/login-methods/password",
    );
    expect(screen.getByRole("link", { name: "Open IP rules" }).getAttribute("href")).toBe(
      "/security/threats/ip-allowlist",
    );
    expect(screen.queryByLabelText(/IP allowlist/i)).toBeNull();
    expect(screen.queryByText(/minimum length/i)).toBeNull();
  });

  it("requires two-step verification for everyone, saved on the rest of the policy", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Change who needs it" }));
    expect(screen.getByText(/27 people haven't yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Everyone/ }));
    const days = await screen.findByRole("textbox", { name: "Days to set it up" });
    fireEvent.change(days, { target: { value: "14" } });
    fireEvent.blur(days);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(puts()).toHaveLength(1));
    const body = puts()[0];
    expect(body).toMatchObject({
      ...policy,
      mfa_enforcement: "required",
      mfa_grace_days: 14,
    });
    expect(body).not.toHaveProperty("ip_allowlist");
    expect(body).not.toHaveProperty("ip_denylist");
    // PUT /policy is step-up gated, so it runs as a sensitive action; Save is the confirmation.
    expect(sensitiveCalls).toEqual([
      expect.objectContaining({ actionLabel: "Change the security policy" }),
    ]);
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("narrows the factors that count, and keeps at least one", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Change factors that count" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Push approval" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]?.step_up_methods).toEqual(["webauthn", "totp", "recovery_code", "otp"]);
  });
});
