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
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
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
import { api } from "@/platform/api/client";
import { Route } from "./tokens";

const TokensPage = Route.options.component as () => React.JSX.Element;
const HOUR = 3_600_000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();
const grant = (id: string, user: string, client: string, h: number) => ({
  id,
  client_id: client,
  user_id: user,
  user_email: `${user}@qeet.in`,
  scopes: ["openid", "email"],
  issued_at: at(-h),
  expires_at: at(48 - h),
});

let revoked: string[];

beforeEach(() => {
  revoked = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/tenant-1/oauth/grants")
      return {
        items: [
          grant("g1", "u1", "qci_logs", 3),
          grant("g2", "u2", "qci_logs", 5),
          grant("g3", "u1", "qci_cli", 20),
        ],
      };
    if (path === "/v1/tenants/tenant-1/oidc/clients")
      return {
        items: [
          { client_id: "qci_logs", name: "Qeet Logs", type: "confidential" },
          { client_id: "qci_cli", name: "Qeet CLI", type: "public" },
          { client_id: "qci_idle", name: "Old app", type: "public" },
        ],
      };
    if (path === "/v1/users") return { items: [], next_cursor: "" };
    if (method === "DELETE") {
      revoked.push(path.split("/").at(-1) ?? "");
      return undefined;
    }
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});

afterEach(cleanup);

describe("Developer › Tokens", () => {
  it("shows the refresh tokens by application, the most first", async () => {
    renderPage(<TokensPage />);
    const table = await screen.findByRole("table", { name: "Refresh tokens by application" });
    await within(table).findByText("Qeet Logs");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText("Confidential")).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByText("Qeet CLI")).toBeTruthy();
    expect(screen.getByText(/1 other application holds no refresh tokens/)).toBeTruthy();
  });

  it("links an application to its grants", async () => {
    renderPage(<TokensPage />);
    const table = await screen.findByRole("table", { name: "Refresh tokens by application" });
    await within(table).findByText("Qeet Logs");
    fireEvent.click(within(table).getByRole("button", { name: /actions for qeet logs/i }));
    expect(
      (await screen.findByRole("menuitem", { name: "See its 2 grants" })).getAttribute("href"),
    ).toBe("/auth/api/consent-grants?app=qci_logs");
  });

  it("confirms revoking all of an application's tokens, then revokes each", async () => {
    renderPage(<TokensPage />);
    const table = await screen.findByRole("table", { name: "Refresh tokens by application" });
    await within(table).findByText("Qeet Logs");
    fireEvent.click(within(table).getByRole("button", { name: /actions for qeet logs/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Revoke all 2 tokens" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(/the 2 people it keeps signed in have to sign in/i),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(revoked).toEqual(["g1", "g2"]));
    expect(toast.success).toHaveBeenCalledWith("2 refresh tokens revoked for Qeet Logs");
  });
});
