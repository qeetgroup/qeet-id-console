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
  useTenantId: () => "t1",
  useUserId: () => "u-me",
  useSessionId: () => "session-1",
}));
const granted = vi.hoisted(() => ({ except: new Set<string>() }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => {
    const can = (c: string) => !granted.except.has(c);
    return { state: "ready", mode: "full", can, canAll: (cs: string[]) => cs.every(can) };
  },
}));
const router = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/users/u1", searchStr: "", hash: "" }),
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: "/users/u1" } }),
  useNavigate: () => router.navigate,
  Link: ({
    to,
    params,
    search,
    children,
    ...props
  }: ComponentProps<"a"> & {
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
    children?: ReactNode;
  }) => {
    const path = to.replace(/\$(\w+)/, (_, key: string) => params?.[key] ?? "");
    const query = search ? new URLSearchParams(search).toString() : "";
    return (
      <a {...props} href={query ? `${path}?${query}` : path}>
        {children}
      </a>
    );
  },
}));
vi.mock("@/modules/organizations", () => ({
  useOrgs: () => ({ data: { items: [{ id: "t1", name: "Qeet Group" }] } }),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import type { SecuritySummary, UserDetail } from "../api/user360";
import { UserDetailPage } from "../pages";

const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const ananya: UserDetail = {
  id: "u1",
  tenant_id: "t1",
  email: "ananya@qeet.in",
  email_verified_at: "2026-04-08T10:23:58Z",
  display_name: "Ananya Iyer",
  status: "active",
  metadata: { title: "Senior Software Engineer", team: "Frontend", employee_id: "QEE-1038" },
  created_at: "2026-04-08T10:23:58Z",
  updated_at: "2026-04-08T10:23:58Z",
};

const protectedAccount: SecuritySummary = {
  mfa_required: false,
  mfa_enabled: true,
  totp_enabled: true,
  otp_factors: 0,
  push_devices: 0,
  passkeys: 1,
  passkey_last_used_at: ago(6 * 24 * HOUR),
  recovery_codes_remaining: 10,
  password_set: true,
  password_changed_at: "2026-04-08T10:23:58Z",
  active_sessions: 1,
  distinct_devices: 1,
};

const signIn = (id: string, method: string, hoursAgo: number) => ({
  id,
  type: "auth.login_succeeded",
  category: "authentication",
  severity: "success",
  title: "Auth Login_succeeded",
  at: ago(hoursAgo * HOUR),
  ip: "203.0.113.10",
  browser: "Edge",
  metadata: { method },
});

let user: UserDetail = ananya;
let security: SecuritySummary = protectedAccount;
let suspension: unknown[] = [];

beforeEach(() => {
  user = ananya;
  security = protectedAccount;
  suspension = [];
  granted.except = new Set();
  router.navigate.mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path: string, options?: { method?: string }) => {
    if ((options?.method ?? "GET") !== "GET") return {};
    if (path === "/v1/users/u1") return user;
    if (path === "/v1/users/u1/security") return security;
    if (path === "/v1/users/u1/access")
      return {
        organization: { id: "t1", name: "Qeet Group", slug: "qeet" },
        roles: [{ id: "r-dev", name: "Developer", description: "Builds integrations" }],
        groups: [{ id: "g-fe", name: "Frontend", description: "" }],
        applications_count: 0,
        policies_count: 6,
        permissions_direct: 12,
        permissions_inherited: 0,
        permissions_total: 12,
      };
    if (path === "/v1/users/u1/sessions")
      return {
        items: [
          {
            id: "s1",
            ip: "203.0.113.10",
            user_agent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0",
            created_at: ago(13 * HOUR),
            last_seen_at: ago(7 * HOUR),
          },
        ],
      };
    if (path === "/v1/activity")
      return {
        events: [
          signIn("e1", "saml", 7),
          signIn("e2", "saml", 30),
          signIn("e3", "password_mfa", 60),
        ],
      };
    if (path === "/v1/users/suspended") return { items: suspension };
    if (path.endsWith("/permissions")) return { permissions: ["user.read", "apikey.write"] };
    if (path === "/v1/users") return { items: [], next_cursor: "" };
    return { items: [] };
  });
});

afterEach(cleanup);

function renderPage(
  tab: "overview" | "access" | "security" | "sessions" | "activity" = "overview",
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <UserDetailPage userId="u1" tab={tab} onTabChange={() => {}} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

const sent = (path: string, method: string) =>
  vi
    .mocked(api)
    .mock.calls.find(([p, o]) => p === path && (o as { method?: string })?.method === method);

describe("the person's page", () => {
  it("names the person in the page heading, with their role, two-step and since when", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Ananya Iyer" })).toBeTruthy();
    expect(screen.getByText("ananya@qeet.in · Senior Software Engineer, Frontend")).toBeTruthy();
    const band = screen.getByText("Member since").closest("dl") as HTMLElement;
    expect(await within(band).findByText("Developer")).toBeTruthy();
    expect(within(band).getByText("In 1 group")).toBeTruthy();
    expect(within(band).getByText("On")).toBeTruthy();
  });

  it("says how the latest sign-ins went: each method, and how many met a second step", async () => {
    renderPage();

    const methods = (await screen.findByText("Single sign-on")).closest("li") as HTMLElement;
    expect(methods.textContent).toContain("2");
    expect(screen.getByText("1 of 3")).toBeTruthy();
    expect(screen.getByText(/^2 sign-ins had no second step · single sign-on asks/)).toBeTruthy();
  });

  it("suspends only after the confirmation says what happens to them", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Suspend" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Suspend Ananya Iyer?");
    expect(dialog.textContent).toContain("signed out everywhere");
    expect(sent("/v1/users/u1", "PATCH")).toBeUndefined();
    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend" }));

    await waitFor(() =>
      expect(sent("/v1/users/u1", "PATCH")?.[1]).toEqual({
        method: "PATCH",
        body: { status: "suspended" },
      }),
    );
  });

  it("says why and since when someone is suspended, and reactivates them straight away", async () => {
    user = { ...ananya, status: "suspended" };
    suspension = [
      {
        id: "u1",
        email: "ananya@qeet.in",
        display_name: "Ananya Iyer",
        avatar_url: null,
        team: "",
        reason: "offboarding",
        source: "manual",
        risk: "low",
        review: "pending",
        suspended_at: "2026-10-02T05:24:08Z",
        last_sign_in: null,
        can_manage: true,
      },
    ];
    renderPage();

    expect(await screen.findByText(/: Offboarding$/)).toBeTruthy();
    expect(screen.getByText(/By an admin on .+2026\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign out everywhere" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reactivate" }));

    await waitFor(() =>
      expect(sent("/v1/users/u1", "PATCH")?.[1]).toEqual({
        method: "PATCH",
        body: { status: "active" },
      }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("deletes after confirming, then goes back to the Users list", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete user" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Delete Ananya Iyer?");
    expect(dialog.textContent).toContain("restore them");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(sent("/v1/users/u1", "DELETE")).toBeTruthy());
    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith({ to: "/users" }));
  });

  it("offers removing someone another organisation manages, and no whole-account action", async () => {
    user = { ...ananya, tenant_id: "t-other", metadata: {} };
    renderPage();

    expect(await screen.findByText("Another organisation manages Ananya's account")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Suspend" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete user" })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Remove from Qeet Group" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(sent("/v1/users/u1/membership", "DELETE")).toBeTruthy());
  });

  it("asks for a second step when a password alone signs in as them", async () => {
    security = { ...protectedAccount, mfa_enabled: false, totp_enabled: false, passkeys: 0 };
    renderPage();

    expect(await screen.findByText("Ananya has no second step")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Always require two-step" }));

    await waitFor(() =>
      expect(sent("/v1/users/u1/mfa-required", "PUT")?.[1]).toEqual({
        method: "PUT",
        body: { required: true },
      }),
    );
  });

  it("offers no change to someone who can only read people", async () => {
    granted.except = new Set(["user.write"]);
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Ananya Iyer" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Suspend" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out everywhere" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete user" })).toBeNull();
  });

  it("shows what they can do by area, and the roles each of their groups gives", async () => {
    renderPage("access");

    const table = await screen.findByRole("table", { name: "Ananya's permissions by area" });
    expect(within(table).getByText("API keys")).toBeTruthy();
    expect(within(table).getByText("View and change")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Frontend" })).toBeTruthy();
  });

  it("takes a role away only after confirming", async () => {
    renderPage("access");

    fireEvent.click(await screen.findByRole("button", { name: "Take away Developer" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Take Developer away from Ananya Iyer?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Take away" }));

    await waitFor(() => expect(sent("/v1/users/u1/tenants/t1/roles/r-dev", "DELETE")).toBeTruthy());
  });

  it("lists how they prove who they are, with a reset for their second steps", async () => {
    renderPage("security");

    expect(await screen.findByRole("heading", { name: /Two-step verification/ })).toBeTruthy();
    expect(screen.getByText("10 left")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Passkeys and sessions stay");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(sent("/v1/users/u1/mfa", "DELETE")).toBeUndefined();
  });

  it("shows where they're signed in, and signs them out everywhere after confirming", async () => {
    renderPage("sessions");

    expect(await screen.findByRole("list", { name: "Signed in" })).toBeTruthy();
    expect(screen.getAllByText("Edge on Windows").length).toBeGreaterThan(0);
    const buttons = screen.getAllByRole("button", { name: "Sign out everywhere" });
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out everywhere" }));

    await waitFor(() => expect(sent("/v1/users/u1/sessions/revoke-all", "POST")).toBeTruthy());
  });

  it("lists their events, and opens one with a way into Activity", async () => {
    renderPage("activity");

    const table = await screen.findByRole("table", { name: "Ananya's activity" });
    fireEvent.click((await within(table).findAllByRole("button"))[0] as HTMLElement);
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("Single sign-on")).toBeTruthy();
    expect(within(drawer).getByRole("link", { name: /Open in Activity/ })).toBeTruthy();
  });
});
