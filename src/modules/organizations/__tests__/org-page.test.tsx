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
  useTenantId: () => "g",
  useUserId: () => "u-me",
  useSessionId: () => "session-1",
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", mode: "full", can: () => true, canAll: () => true }),
}));
const switchToTenant = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/modules/authentication", () => ({ switchToTenant }));
vi.mock("@/modules/billing", () => ({
  useSubscription: () => ({
    data: {
      plan_code: "enterprise",
      plan_name: "Enterprise",
      currency: "INR",
      amount_minor: 2_490_000,
      interval: "month",
      status: "active",
      current_period_start: "2026-10-18T09:00:00Z",
      current_period_end: "2026-11-18T09:00:00Z",
      cancel_at_period_end: false,
      trial_end: null,
    },
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/organizations/g", searchStr: "", hash: "" }),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  Link: ({
    to,
    params,
    search,
    children,
    ...props
  }: ComponentProps<"a"> & {
    to: string;
    params?: { orgId: string };
    search?: Record<string, string>;
    children?: ReactNode;
  }) => {
    const path = to.replace("$orgId", params?.orgId ?? "");
    const query = search ? new URLSearchParams(search).toString() : "";
    return (
      <a {...props} href={query ? `${path}?${query}` : path}>
        {children}
      </a>
    );
  },
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import type { Org } from "../api/orgs";
import { OrgPage } from "../components/page/org-page";

const GROUP: Org = {
  id: "g",
  slug: "qeet",
  name: "Qeet Group",
  status: "active",
  plan: "enterprise",
  region: "ap-south-1",
  logo_url: "",
  created_at: "2025-08-18T09:00:00Z",
  member_count: 46,
  mfa_enabled_count: 18,
  metadata: { industry: "Software", headquarters: "Bengaluru, IN", website: "https://qeet.in" },
};
const SANDBOX: Org = {
  ...GROUP,
  id: "s",
  slug: "qeet-sandbox",
  name: "Qeet Sandbox",
  plan: "free",
};
const membership = (id: string, roles: string[], domain = "") => ({
  id,
  name: id,
  slug: id,
  plan: "free",
  region: "ap-south-1",
  logo_url: "",
  domain,
  roles,
  last_used_at: "2026-10-21T05:00:00Z",
});
const HISTORY = [
  {
    id: "e2",
    action: "security_policy.updated",
    resource_type: "tenant",
    actor_user_id: "u-shalini",
    ip: "203.0.113.34",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/153.0.0.0 Safari/537.36",
    created_at: "2026-09-15T04:00:00Z",
  },
  {
    id: "e1",
    action: "tenant.created",
    resource_type: "tenant",
    actor_user_id: "u-mareedu",
    created_at: "2025-08-18T09:00:00Z",
  },
];
const state = vi.hoisted(() => ({ roles: ["Admin"], due: null as string | null }));

beforeEach(() => {
  state.roles = ["Admin"];
  state.due = null;
  switchToTenant.mockClear();
  vi.mocked(api).mockImplementation(async (path: string, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants") return { items: [GROUP, SANDBOX], next_cursor: "" };
    if (path === "/v1/me/organizations")
      return {
        items: [membership("g", state.roles, "qeet.in"), membership("s", ["owner"])],
        next_cursor: "",
      };
    if (path === "/v1/tenants/g" && method === "GET")
      return { ...GROUP, deletion_due_at: state.due };
    if (path === "/v1/tenants/g" && method === "DELETE")
      return { tenant_id: "g", deletion_due_at: "2026-11-04T09:00:00Z" };
    if (path === "/v1/tenants/g/deletion/cancel") return GROUP;
    if (path === "/v1/tenants/g/audit") return { items: HISTORY };
    if (path === "/v1/tenants/g/domains")
      return { items: [{ domain: "qeet.in", verified_at: "2025-08-19T06:00:00Z" }] };
    if (path === "/v1/users/u-shalini")
      return { id: "u-shalini", email: "s@qeet.in", display_name: "Shalini Goyal" };
    if (path === "/v1/users/u-mareedu")
      return { id: "u-mareedu", email: "m@qeet.in", display_name: "Mareedu Saibabu" };
    throw new Error(`unexpected request: ${method} ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

function renderPage(orgId = "g") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <OrgPage orgId={orgId} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}
const writes = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => `${options?.method} ${path}`);

describe("an organisation's page, the one you're in", () => {
  it("shows its identity: address, domain and what it means, data region", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Qeet Group", level: 1 })).toBeTruthy();
    expect(screen.getByText("qeet")).toBeTruthy();
    expect(
      screen.getByText(
        "Qeet Group manages the accounts on @qeet.in: no other organisation can create them.",
      ),
    ).toBeTruthy();
    // The date is in the reader's locale; only the year is fixed here.
    expect(await screen.findByText(/^Verified .*2025 with a DNS record/)).toBeTruthy();
    expect(
      screen.getByRole("img", { name: /Its data region, Asia Pacific \(Mumbai\)/ }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit details" }).getAttribute("href")).toBe(
      "/settings/organization/general",
    );
  });

  it("sums up its history and opens each change in Activity", async () => {
    renderPage();
    const history = (await screen.findByRole("heading", { name: "History" })).closest(
      "section",
    ) as HTMLElement;
    const change = await within(history).findByRole("link", { name: "Sign-in rules changed" });
    expect(change.getAttribute("href")).toContain("/activity?range=custom");
    expect(change.getAttribute("href")).toContain("event=e2");
    expect(await within(history).findByText("Shalini Goyal")).toBeTruthy();
    expect(within(history).getByText("· Chrome on Windows")).toBeTruthy();
    expect(within(history).getByText("2 people")).toBeTruthy();
  });

  it("offers an admin no Delete: only an owner can", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "History" });
    expect(screen.getByText("Only an owner can delete it")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Delete organisation/ })).toBeNull();
  });

  it("schedules an owner's deletion after the confirm, and does nothing when it's cancelled", async () => {
    state.roles = ["owner"];
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete organisation" }));
    let dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Delete Qeet Group?")).toBeTruthy();
    expect(within(dialog).getByText(/its 46 people lose access/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Delete organisation" }));
    dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete organisation" }));
    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/tenants/g"]));
  });

  it("while a deletion is scheduled, says when and lets an owner keep it", async () => {
    state.roles = ["owner"];
    state.due = "2026-11-04T09:00:00Z";
    renderPage();
    expect(await screen.findByText(/Qeet Group will be deleted on .*2026/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete organisation" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Keep Qeet Group" }));
    await waitFor(() => expect(writes()).toEqual(["POST /v1/tenants/g/deletion/cancel"]));
  });
});

describe("another organisation's page", () => {
  it("shows what the list knows and Switch, and nothing it can't read", async () => {
    renderPage("s");
    expect(await screen.findByRole("heading", { name: "Qeet Sandbox", level: 1 })).toBeTruthy();
    expect(screen.getByText("You're working in Qeet Group")).toBeTruthy();
    expect(screen.getByText("No domain yet")).toBeTruthy();
    expect(screen.getByText("After switching, you can delete it")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "History" })).toBeNull();
    const asked = vi.mocked(api).mock.calls.map(([path]) => path);
    expect(asked.some((p) => p.startsWith("/v1/tenants/s"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Switch to Qeet Sandbox" }));
    await waitFor(() => expect(switchToTenant).toHaveBeenCalledWith("s"));
  });

  it("says so when it isn't one you belong to", async () => {
    renderPage("nope");
    expect(await screen.findByText("Organisation not found")).toBeTruthy();
  });
});
