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
  useTenantId: () => "t-1",
  useUserId: () => "u-me",
  useSessionId: () => "s-1",
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", mode: "full", can: () => true, canAll: () => true }),
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/security/device-authorizations", searchStr: "", hash: "" }),
  useNavigate: () => vi.fn(),
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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Records what each sensitive action asked for, then runs it through the real provider.
const sensitiveCalls = vi.hoisted(
  () => [] as { actionLabel?: string; confirm?: { description?: string } }[],
);
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
import { DevicesPage } from "../components/devices-page";

const now = Date.now();
const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();
const device = (id: string, code: string, status: string, expires: number, user = false) => ({
  id,
  client_id: "qci_cli",
  user_code: code,
  status,
  user_id: user ? "u-1" : null,
  user_email: user ? "rohan@qeet.in" : "",
  scopes: ["openid", "profile"],
  created_at: at(-12),
  expires_at: at(expires),
  last_polled_at: null,
});

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/oauth/devices" && method === "GET")
      return {
        items: [
          device("d-wait", "WAIT-CODE", "pending", 5),
          device("d-old", "OLD0-CODE", "pending", -2),
          device("d-ok", "GOOD-CODE", "authorized", -2, true),
        ],
      };
    if (path === "/v1/tenants/t-1/oidc/clients")
      return { items: [{ id: "c1", client_id: "qci_cli", name: "Qeet CLI" }] };
    if (path === "/v1/tenants/t-1/oauth/devices/d-wait" && method === "DELETE") return undefined;
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});
afterEach(cleanup);

function renderWith(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>{node}</SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

const changes = () =>
  vi
    .mocked(api)
    .mock.calls.map(([path, options]) => `${options?.method ?? "GET"} ${path}`)
    .filter((r) => !r.startsWith("GET "));

describe("Authentication › Device sign-ins", () => {
  it("calls a lapsed code expired, whatever its status says, and names the application", async () => {
    renderWith(<DevicesPage filters={{}} onFiltersChange={vi.fn()} />);
    const table = await screen.findByRole("table", { name: "Device sign-ins" });
    const row = (code: string) => within(table).getByText(code).closest("tr") as HTMLElement;
    await waitFor(() => expect(within(row("OLD0-CODE")).getByText("Expired")).toBeTruthy());
    expect(within(row("WAIT-CODE")).getByText("Waiting")).toBeTruthy();
    expect(within(row("GOOD-CODE")).getByText("Approved")).toBeTruthy();
    expect(within(table).getAllByText("Qeet CLI").length).toBe(3);
  });

  it("offers Deny only on a waiting code, and asks first", async () => {
    renderWith(<DevicesPage filters={{}} onFiltersChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Code GOOD-CODE" }));
    await screen.findByRole("menuitem", { name: "The approver's events in the audit log" });
    expect(screen.queryByRole("menuitem", { name: "Deny" })).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    fireEvent.click(await screen.findByRole("button", { name: "Actions for Code WAIT-CODE" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Deny" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/for Qeet CLI gets no access/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Deny" }));
    await waitFor(() => expect(changes()).toEqual(["DELETE /v1/tenants/t-1/oauth/devices/d-wait"]));
  });
});
