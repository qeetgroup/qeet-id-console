// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { toast } from "sonner";
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
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/invitations", searchStr: "", hash: "" }),
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
    params?: { userId: string };
    search?: Record<string, string>;
    children?: ReactNode;
  }) => {
    const path = to.replace("$userId", params?.userId ?? "");
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
import type { Invitation } from "../api/invitations";
import type { InvitationFilters } from "../invitations-model";
import { InvitationsPage } from "../pages";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
function invite(id: string, overrides: Partial<Invitation>): Invitation {
  return {
    id,
    tenant_id: "t1",
    email: `${id}@qeet.in`,
    role_id: "role-member",
    status: "pending",
    expires_at: ago(-10.5),
    accepted_at: null,
    created_at: ago(3.5),
    ...overrides,
  };
}
const INVITES = [
  invite("kavya", {}),
  invite("ravi", { expires_at: ago(-1.5), created_at: ago(12.5) }),
  invite("kabir", {
    status: "accepted",
    created_at: ago(40),
    accepted_at: ago(38),
    role_id: "role-dev",
  }),
  invite("omar", { status: "expired", created_at: ago(60), expires_at: ago(46) }),
  invite("imran", { status: "revoked", created_at: ago(20) }),
];

beforeEach(() => {
  granted.except = new Set();
  vi.spyOn(toast, "success").mockImplementation(() => "");
  vi.mocked(api).mockImplementation(async (path: string, opts?: { method?: string }) => {
    const method = opts?.method ?? "GET";
    if (method === "GET") {
      if (path === "/v1/tenants/t1/invites") return { items: INVITES };
      if (path === "/v1/tenants/t1/roles")
        return {
          items: [
            { id: "role-member", name: "Member" },
            { id: "role-dev", name: "Developer" },
          ],
        };
      if (path === "/v1/users")
        return {
          items: [
            {
              id: "u-kabir",
              tenant_id: "t1",
              email: "kabir@qeet.in",
              display_name: "Kabir Fernandes",
              status: "active",
              created_at: ago(38),
            },
          ],
        };
    }
    if (path.endsWith("/resend") && method === "POST") return { invite: INVITES[0] };
    if (path.startsWith("/v1/invites/") && method === "DELETE") return undefined;
    if (path === "/v1/invites" && method === "POST") return { invite: INVITES[4] };
    throw new Error(`unexpected request: ${method} ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(api).mockReset();
});

function renderPage(filters: InvitationFilters = {}, onFiltersChange = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <InvitationsPage filters={filters} onFiltersChange={onFiltersChange} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
  return { onFiltersChange };
}
const writes = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([, o]) => (o as { method?: string } | undefined)?.method)
    .map(([p, o]) => `${(o as { method: string }).method} ${p}`);
async function rowOf(email: string) {
  const table = await screen.findByRole("table", { name: "Invitations" });
  return (await within(table).findByText(email)).closest("tr") as HTMLElement;
}
async function openMenu(row: HTMLElement) {
  fireEvent.click(within(row).getAllByRole("button").at(-1) as HTMLElement);
  return screen.findByRole("menu");
}

describe("the Invitations tab", () => {
  it("leads with who's waiting, how fast people join, what's been sent and the outcomes", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Invitations", level: 1 })).toBeTruthy();
    expect(await screen.findByText("The next link expires in 2 days")).toBeTruthy();
    expect(screen.getByText("2 days")).toBeTruthy();
    expect(screen.getByText("The median · everyone within 2 days")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See who's waiting →" }).getAttribute("href")).toBe(
      "/invitations?status=pending",
    );
    expect(screen.getByRole("link", { name: /Joined\s*1/ }).getAttribute("href")).toBe(
      "/invitations?status=accepted",
    );
    expect(screen.getByRole("link", { name: /Expired before they joined/ }).textContent).toContain(
      "1",
    );
  });

  it("says where each one stands, and names the people who joined", async () => {
    renderPage();
    expect(within(await rowOf("kavya@qeet.in")).getByText("Expires in 11 days")).toBeTruthy();
    expect(within(await rowOf("ravi@qeet.in")).getByText("Expires in 2 days")).toBeTruthy();
    const kabir = (await screen.findByText("Kabir Fernandes")).closest("tr") as HTMLElement;
    expect(within(kabir).getByText("Joined after 2 days")).toBeTruthy();
    expect(within(kabir).getByText("Developer")).toBeTruthy();
    expect(within(await rowOf("imran@qeet.in")).getByText("Revoked")).toBeTruthy();
  });

  it("filters from the address and says how many that leaves", async () => {
    renderPage({ status: "pending" });
    await rowOf("kavya@qeet.in");
    expect(screen.queryByText("Kabir Fernandes")).toBeNull();
    expect(screen.getByText("2 of 5 invitations")).toBeTruthy();
  });

  it("resends a waiting invitation from its menu", async () => {
    renderPage();
    const menu = await openMenu(await rowOf("kavya@qeet.in"));
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Resend the email" }));
    await waitFor(() => expect(writes()).toEqual(["POST /v1/invites/kavya/resend"]));
  });

  it("revokes only after the admin confirms", async () => {
    renderPage();
    const menu = await openMenu(await rowOf("kavya@qeet.in"));
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Revoke" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Revoke the invitation for kavya@qeet.in?");
    expect(writes()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/invites/kavya"]));
  });

  it("invites someone afresh after a revoke, with the same role", async () => {
    renderPage();
    const menu = await openMenu(await rowOf("imran@qeet.in"));
    expect(within(menu).queryByRole("menuitem", { name: "Resend the email" })).toBeNull();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Invite again" }));
    await waitFor(() => expect(writes()).toEqual(["POST /v1/invites"]));
    const body = vi
      .mocked(api)
      .mock.calls.find(([p, o]) => p === "/v1/invites" && o?.method === "POST")?.[1]?.body;
    expect(body).toEqual({ tenant_id: "t1", email: "imran@qeet.in", role_id: "role-member" });
  });

  it("is read-only without user.write: no selection, no menus, no Invite people", async () => {
    granted.except = new Set(["user.write"]);
    renderPage();
    const row = await rowOf("kavya@qeet.in");
    expect(within(row).queryAllByRole("checkbox")).toEqual([]);
    expect(within(row).queryAllByRole("button")).toEqual([]);
    expect(screen.queryByRole("button", { name: "Invite people" })).toBeNull();
  });
});
