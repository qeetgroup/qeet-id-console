// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
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
  useUserId: () => "user-1",
  useSessionId: () => "session-1",
}));
const granted = vi.hoisted(() => ({ all: true, except: new Set<string>() }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => {
    const can = (c: string) => granted.all && !granted.except.has(c);
    return { state: "ready", mode: "full", can, canAll: (cs: string[]) => cs.every(can) };
  },
}));
vi.mock("@/modules/dashboard/use-dashboard-activity", () => ({
  useDashboardActivity: () => ({
    status: "connected",
    connecting: false,
    events: [
      {
        id: "e1",
        type: "auth.token_reuse_detected",
        category: "security",
        severity: "critical",
        title: "Refresh token reused",
        actor: { name: "Mareedu Saibabu" },
        at: new Date().toISOString(),
      },
    ],
  }),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
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

import { api } from "@/platform/api/client";
import { Route } from "./index";

const DashboardPage = Route.options.component as () => React.JSX.Element;
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const dates = Array.from({ length: 14 }, (_, i) => day(i - 13).slice(0, 10));

const overview = {
  generated_at: new Date().toISOString(),
  kpis: {
    mau: { value: 45, delta_pct: 0 },
    logins_today: { value: 62, delta_pct: 106 },
    mfa_adoption_pct: { value: 38.6, delta_pct: 2 },
    failed_logins_24h: { value: 56, delta_pct: 5500 },
    dau: { value: 30, delta_pct: 50 },
    total_users: { value: 45, delta_pct: 2 },
    avg_sessions_per_user: { value: 27.5, delta_pct: 0 },
    stickiness_pct: { value: 66.7, delta_pct: -11 },
  },
  weekly_activity_8w: ["W37", "W38", "W39", "W40", "W41", "W42", "W43", "W44"].map((week) => ({
    week,
    wau: 43,
    dau: 25,
  })),
  user_trend_14d: dates.map((date) => ({ date, value: 45 })),
  login_trend_14d: dates.map((date, i) => ({ date, value: i === 12 ? 30 : i === 13 ? 62 : 40 })),
  mfa_trend_14d: dates.map((date) => ({ date, value: 38 })),
  failed_trend_14d: dates.map((date, i) => ({ date, value: i === 12 ? 1 : 3 })),
  login_activity_14d: dates.map((date) => ({
    date,
    password: 10,
    passkey: 1,
    social: 4,
    saml: 20,
    oidc: 0,
    magic_link: 5,
    ldap: 0,
  })),
  login_methods_mix: [
    { method: "saml", value: 46.6 },
    { method: "password", value: 28.4 },
    { method: "passkey", value: 2.2 },
  ],
  mfa_methods_adoption: [{ method: "TOTP", users: 17 }],
  failed_logins_hourly_24h: Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, "0")}:00`,
    attempts: i === 0 ? 26 : 0,
  })),
};

const RESPONSES: Record<string, unknown> = {
  "/v1/tenants/t1/analytics/overview": overview,
  "/v1/users/stats": {
    total: 45,
    active: 44,
    suspended: 1,
    invited: 0,
    mfa_enabled: 18,
    mfa_missing: 27,
    new_last_30d: 2,
  },
  "/v1/tenants/t1/invites": {
    items: [
      {
        id: "i1",
        tenant_id: "t1",
        email: "sai@qeet.in",
        status: "pending",
        expires_at: day(10),
        created_at: day(-3),
      },
    ],
  },
  "/v1/auth/trusted-devices/count": { devices: 5, users: 4 },
  "/v1/tenants/t1/auth-policy": {
    password_enabled: true,
    passkey_enabled: true,
    magic_link_enabled: true,
  },
  "/v1/tenants/t1/social/providers": { items: [{ provider: "google", enabled: true }] },
  "/v1/tenants/t1/saml": { items: [{ id: "s1", name: "Google Workspace", status: "active" }] },
  "/v1/tenants/t1/saml-providers": { items: [{ id: "p1", name: "Slack", status: "active" }] },
  "/v1/tenants/t1/scim": {
    token_set: false,
    created_at: null,
    last_used_at: null,
    provisioned_count: 0,
  },
  "/v1/tenants/t1/ldap": {
    items: [
      {
        id: "l1",
        name: "Staging Directory (test)",
        server_url: "ldaps://ldap.staging.qeet.in:636",
        status: "draft",
        created_at: day(-19),
      },
    ],
  },
  "/v1/tenants/t1/directory/connections": {
    items: [
      {
        id: "l1",
        name: "Staging Directory (test)",
        reference: "l1",
        type: "ldap",
        status: "draft",
        health: "unknown",
        environment: null,
        scope: "users-on-signin",
        created_at: day(-19),
        last_activity_at: null,
        last_sync_at: null,
        user_count: null,
        group_count: null,
        server_url: "ldaps://ldap.staging.qeet.in:636",
      },
    ],
  },
  "/v1/tenants/t1/directory/errors": {
    items: [
      {
        id: "e1",
        connection_id: "l1",
        category: "connection",
        severity: "critical",
        resolution: "open",
        started_at: day(-6),
        message: "ldaps://ldap.staging.qeet.in:636: no such host",
        error_code: "DIR-502",
      },
    ],
    total: 1,
    limit: 100,
    offset: 0,
    summary: { open: 1, critical: 1, warning: 0, retried: 0, impacted_users: 0 },
    categories: [],
    connections: [],
    remediations: [],
  },
  "/v1/tenants/t1/groups": {
    items: [
      { id: "g1", tenant_id: "t1", name: "Engineering", description: "", member_count: 3 },
      { id: "g2", tenant_id: "t1", name: "Partnerships", description: "", member_count: 0 },
    ],
  },
  "/v1/permissions": { items: [{ id: "p1", key: "users.*", description: "" }] },
  "/v1/tenants/t1/abac/policies": { items: [] },
  "/v1/tenants": { items: [{ id: "t1", name: "Qeet Group" }] },
  "/v1/users": {
    items: [
      {
        id: "u1",
        metadata: { department: "Engineering", team: "Payments", location: "Bengaluru, IN" },
      },
      {
        id: "u2",
        metadata: { department: "Engineering", team: "Payments", location: "Bengaluru, IN" },
      },
      { id: "u3", metadata: { department: "Sales", location: "Berlin, DE" } },
      { id: "u4", metadata: {} },
    ],
  },
  "/v1/tenants/t1/oidc/clients": {
    items: [
      {
        id: "c1",
        client_id: "qci_logs",
        name: "Qeet Logs",
        type: "confidential",
        redirect_uris: ["https://logs.qeet.in/cb"],
        grant_types: [],
        scopes: [],
        created_at: day(-90),
      },
    ],
  },
  "/v1/tenants/t1/oauth/grants": {
    items: [
      {
        id: "g1",
        client_id: "qci_logs",
        user_id: "u1",
        user_email: "a@qeet.in",
        scopes: [],
        issued_at: day(-1),
        expires_at: day(30),
      },
    ],
  },
  "/v1/tenants/t1/domains": { items: [{ id: "d1", domain: "qeet.in", status: "verified" }] },
  "/v1/tenants/t1/api-keys": {
    items: [
      {
        id: "k1",
        tenant_id: "t1",
        name: "Backoffice sync",
        prefix: "qk_",
        scopes: null,
        expires_at: day(5),
        created_at: day(-60),
      },
    ],
  },
  "/v1/tenants/t1/webhooks": {
    items: [
      {
        id: "w1",
        tenant_id: "t1",
        url: "https://staging-api.qeet.in/hook",
        events: [],
        disabled_at: day(-5),
        disabled_reason: "failing",
        created_at: day(-90),
      },
    ],
  },
  "/v1/tenants/t1/security/anomalies": { items: [] },
  "/v1/tenants/t1/billing/subscription": {
    plan_code: "enterprise",
    plan_name: "Enterprise",
    currency: "INR",
    amount_minor: 2_490_000,
    interval: "month",
    status: "active",
    current_period_start: day(-10),
    current_period_end: day(20),
    cancel_at_period_end: false,
    trial_end: null,
  },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  granted.all = true;
  granted.except = new Set();
  vi.mocked(api).mockImplementation(async (path: string) => {
    if (path in RESPONSES) return RESPONSES[path];
    throw new Error(`unexpected request: ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

describe("the Dashboard", () => {
  it("leads with today's measures and two-step coverage against its target", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Overview", level: 1 })).toBeTruthy();
    expect(await screen.findByText("62")).toBeTruthy();
    expect(screen.getByText("Up from 30 yesterday · 14 days")).toBeTruthy();
    expect(screen.getByText("67% of the 45 active this month")).toBeTruthy();
    expect(screen.getAllByText("40%").length).toBeGreaterThan(0);
    expect(screen.getByText("18 of 45 people · target 80%")).toBeTruthy();
  });

  it("lists what needs attention, most severe first, each with its action", async () => {
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Needs attention" })).closest(
      "section",
    ) as HTMLElement;
    const rows = await within(panel).findAllByRole("listitem");
    expect(rows[0]?.textContent).toContain("Webhook turned off");
    expect(
      within(rows[0] as HTMLElement)
        .getByRole("link", { name: "Open" })
        .getAttribute("href"),
    ).toBe("/developer/webhooks/w1");
    expect(within(panel).getByText("An API key expires in 5 days")).toBeTruthy();
    expect(within(panel).getByText("Two-step verification is under the target")).toBeTruthy();
    expect(within(panel).queryByText("MFA adoption below target")).toBeNull();
  });

  it("brings in the directory's and authorization's alerts, which their overviews used to carry", async () => {
    renderPage();
    const panel = (await screen.findByRole("heading", { name: "Needs attention" })).closest(
      "section",
    ) as HTMLElement;
    const down = (
      await within(panel).findByText("Staging Directory (test) can't reach its server")
    ).closest("li") as HTMLElement;
    expect(down.textContent).toContain("LDAP · its last check failed 6 days ago: no such host");
    expect(within(down).getByRole("link", { name: "Fix it" }).getAttribute("href")).toBe(
      "/directory/connections",
    );
    fireEvent.click(await within(panel).findByRole("button", { name: /^Show \d+ more$/ }));
    expect(await within(panel).findByText("A group has no members")).toBeTruthy();
    expect(within(panel).getByText("Partnerships")).toBeTruthy();
    expect(
      await within(panel).findByText("A wildcard permission grants broad access"),
    ).toBeTruthy();
  });

  it("shows how the organisation is made up: departments and their teams, and where people work", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "How Qeet Group is organised" }),
    ).toBeTruthy();
    const map = screen.getByRole("list", { name: "Departments and their teams" });
    expect(
      within(map)
        .getByRole("link", { name: "Engineering, 2 people: Payments 2" })
        .getAttribute("href"),
    ).toBe("/users");
    expect(within(map).getByText("No department, 1 person")).toBeTruthy();
    expect(
      screen.getByText("1 person is in a department but no team · 1 person has no department"),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Where people work" })).toBeTruthy();
    expect(screen.getByText("2 cities in 2 countries, sized by people")).toBeTruthy();
    expect(screen.getByText("Bengaluru, 2 people")).toBeTruthy();
    expect(screen.getByText("50% of people work in Bengaluru")).toBeTruthy();
  });

  it("shows the set-up as a checklist, with an action only where something's needed", async () => {
    renderPage();
    const progress = await screen.findByText(/of \d+ done$/);
    expect(progress.textContent).toBe("7 of 13 done");
    const sso = screen
      .getByText("Single sign-on", { selector: "strong" })
      .closest("li") as HTMLElement;
    expect(sso.textContent).toContain("Connected · Google Workspace");
    expect(within(sso).queryByRole("link")).toBeNull();
    const scim = screen.getByText("Directory sync (SCIM)").closest("li") as HTMLElement;
    expect(within(scim).getByRole("link", { name: "Set up" }).getAttribute("href")).toBe(
      "/auth/connections/scim",
    );
    const ldap = screen.getByText("LDAP", { selector: "strong" }).closest("li") as HTMLElement;
    expect(ldap.textContent).toContain("Staging Directory (test): its check failed 6 days ago");
    const groups = screen.getByText("Groups", { selector: "strong" }).closest("li") as HTMLElement;
    expect(groups.textContent).toContain("2 groups · 1 has no members");
  });

  it("switches the sign-ins chart to a table of every day", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Table" }));
    const table = await screen.findByRole("table", { name: "Sign-ins, last 14 days" });
    expect(within(table).getAllByRole("row").length).toBe(15);
  });

  it("never changes the organisation on load (no step-up prompt for a new administrator)", async () => {
    renderPage();
    await screen.findByText(/of \d+ done$/);
    for (const [, options] of vi.mocked(api).mock.calls) {
      expect((options as { method?: string } | undefined)?.method ?? "GET").toBe("GET");
    }
  });

  it("without analytics, says so and still shows what the person may see", async () => {
    granted.except = new Set(["analytics.read"]);
    renderPage();
    expect(await screen.findByText("Your operator view is scoped")).toBeTruthy();
    expect(screen.queryByText("Sign-ins, last 14 days")).toBeNull();
    await waitFor(() => expect(screen.getByText(/of \d+ done$/)).toBeTruthy());
    expect(vi.mocked(api).mock.calls.some(([path]) => String(path).includes("analytics"))).toBe(
      false,
    );
  });
});
