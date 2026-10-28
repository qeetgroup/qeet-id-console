// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await import("@/platform/errors/api-error");
  return { api: vi.fn(), ApiError };
});
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
const can = vi.hoisted(() => ({ write: true }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: "ready",
    can: (c?: string) => (c === "connection.write" ? can.write : true),
  }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/modules/dashboard", async () =>
  (await import("@/modules/authentication/components/methods/__tests__/stubs")).dashboardStub(),
);
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: (await import("@/modules/authentication/components/methods/__tests__/stubs")).RouterLink,
}));

import { toast } from "sonner";
import { renderPage } from "@/modules/authentication/components/methods/__tests__/kit";
import { ConsentGrantsPage } from "@/modules/authentication/pages";
import { api } from "@/platform/api/client";
import { Route } from "./consent-grants";

const HOUR = 3_600_000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();
const grant = (
  id: string,
  user: string,
  email: string,
  client: string,
  scopes: string[],
  h: number,
) => ({
  id,
  client_id: client,
  user_id: user,
  user_email: email,
  scopes,
  issued_at: at(-h),
  expires_at: at(24 * 7 - h),
});
const GRANTS = [
  grant("g1", "u1", "sneha@qeet.in", "qci_pay", ["openid", "profile", "email", "phone"], 7),
  grant("g2", "u2", "ines@qeet.in", "qci_desk", ["openid", "profile", "email"], 8),
  grant("g3", "u1", "sneha@qeet.in", "qci_desk", ["openid", "profile", "email"], 30),
];

let revoked: string[];

beforeEach(() => {
  revoked = [];
  can.write = true;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/tenant-1/oauth/grants") return { items: GRANTS };
    if (path === "/v1/tenants/tenant-1/oidc/clients")
      return {
        items: [
          { client_id: "qci_pay", name: "Qeet Pay Dashboard", type: "confidential" },
          { client_id: "qci_desk", name: "Support Desk", type: "public" },
        ],
      };
    if (path === "/v1/users")
      return {
        items: [
          { id: "u1", email: "sneha@qeet.in", display_name: "Sneha Kulkarni" },
          { id: "u2", email: "ines@qeet.in", display_name: "Inès Tanaka" },
        ],
        next_cursor: "",
      };
    if (method === "DELETE") {
      revoked.push(path.split("/").at(-1) ?? "");
      return undefined;
    }
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});

afterEach(cleanup);

function renderList(filters = {}) {
  const onFiltersChange = vi.fn();
  renderPage(<ConsentGrantsPage filters={filters} onFiltersChange={onFiltersChange} />);
  return { onFiltersChange };
}

describe("Applications › OAuth grants", () => {
  it("has the route draw its own header, with filters in the address", () => {
    expect(Route.options.staticData).toMatchObject({ pageHeader: true });
    const search = Route.options.validateSearch as unknown as {
      parse: (v: unknown) => unknown;
    };
    expect(search.parse({ app: "qci_pay", access: "phone", junk: "x" })).toEqual({
      app: "qci_pay",
      access: "phone",
    });
    expect(search.parse({ access: "everything" })).toEqual({});
  });

  it("lists grants by person and application name, most recently renewed first", async () => {
    renderList();
    const table = await screen.findByRole("table", { name: "OAuth grants" });
    expect(await within(table).findAllByText("Sneha Kulkarni")).toHaveLength(2);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(within(rows[0] as HTMLElement).getByText("Qeet Pay Dashboard")).toBeTruthy();
    expect(within(rows[0] as HTMLElement).getByText("Profile, Email, Phone number")).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText("Inès Tanaka")).toBeTruthy();
  });

  it("puts the key numbers in the header, each a way into the list", async () => {
    renderList();
    expect(await screen.findByText("For 2 people")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Support Desk 2/ }).getAttribute("href")).toBe(
      "/auth/api/consent-grants?app=qci_desk",
    );
    expect(screen.getByRole("link", { name: /Phone number\s*1/ }).getAttribute("href")).toBe(
      "/auth/api/consent-grants?access=phone",
    );
  });

  it("filters by application and drops that column", async () => {
    renderList({ app: "qci_desk" });
    const table = await screen.findByRole("table", { name: "OAuth grants" });
    await within(table).findByText("Sneha Kulkarni");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).queryByRole("columnheader", { name: /application/i })).toBeNull();
    expect(screen.getByText("2 of 3 grants")).toBeTruthy();
  });

  it("searches by name", async () => {
    renderList({ q: "inès" });
    const table = await screen.findByRole("table", { name: "OAuth grants" });
    await within(table).findByText("Inès Tanaka");
    expect(within(table).queryByText("Sneha Kulkarni")).toBeNull();
  });

  it("confirms revoking one with what happens to the person", async () => {
    renderList();
    const table = await screen.findByRole("table", { name: "OAuth grants" });
    await within(table).findByText("Inès Tanaka");
    fireEvent.click(
      within(table).getByRole("button", { name: /actions for Inès Tanaka, Support Desk/i }),
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Revoke grant" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(/support desk can't renew inès tanaka's sign-in/i),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(revoked).toEqual(["g2"]));
    expect(toast.success).toHaveBeenCalledWith("1 grant revoked");
  });

  it("revokes several chosen at once, one request each", async () => {
    renderList();
    const table = await screen.findByRole("table", { name: "OAuth grants" });
    await within(table).findByText("Inès Tanaka");
    for (const box of within(table).getAllByRole("checkbox").slice(1, 3)) fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: "Revoke 2 grants" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(revoked).toHaveLength(2));
  });

  it("offers no revoking to someone who can only read connections", async () => {
    can.write = false;
    renderList();
    const table = await screen.findByRole("table", { name: "OAuth grants" });
    await within(table).findByText("Inès Tanaka");
    expect(within(table).queryByRole("checkbox")).toBeNull();
  });
});
