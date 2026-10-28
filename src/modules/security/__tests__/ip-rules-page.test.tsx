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
  useLocation: () => ({ pathname: "/security/threats/ip-allowlist", searchStr: "", hash: "" }),
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
import { IpRulesPage } from "../components/threats/ip-rules-page";

const RULES = [
  {
    id: "r-office",
    tenant_id: "t-1",
    cidr: "203.0.113.0/24",
    label: "Pune office",
    action: "allow",
    created_at: "2026-10-20T08:00:00Z",
  },
  {
    id: "r-bad",
    tenant_id: "t-1",
    cidr: "192.0.2.244/30",
    label: "Proxies",
    action: "deny",
    created_at: "2026-10-20T08:00:00Z",
  },
];
let enabled = false;

beforeEach(() => {
  enabled = false;
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (method === "GET" && path === "/v1/tenants/t-1/ip-rules") return { enabled, items: RULES };
    if (method === "GET" && path === "/v1/tenants/t-1/audit") {
      if (options?.query?.action === "ip_rules.enforcement_changed")
        return {
          items: [
            { id: "e1", created_at: "2026-08-27T10:00:00Z", ip: null, actor_user_id: "u-priya" },
          ],
        };
      // The list leaves metadata out: the rule is the resource, the person the actor.
      return {
        items: [
          {
            id: "a1",
            created_at: "2026-10-20T09:00:00Z",
            ip: "192.0.2.245",
            actor_user_id: "u-priya",
            resource_id: "r-bad",
          },
          {
            id: "a2",
            created_at: "2026-10-20T09:05:00Z",
            ip: "198.51.100.4",
            actor_user_id: null,
            resource_id: null,
          },
        ],
      };
    }
    if (method === "GET" && path === "/v1/users")
      return {
        items: [
          {
            id: "u-priya",
            email: "priya@qeet.in",
            display_name: "Priya Nair",
            status: "active",
            tenant_id: "t-1",
            created_at: "",
          },
        ],
      };
    if (method === "POST" && path === "/v1/tenants/t-1/ip-rules")
      return { ...RULES[0], id: "r-new" };
    if (method === "DELETE" && path.startsWith("/v1/tenants/t-1/ip-rules/")) return undefined;
    if (method === "PUT" && path === "/v1/tenants/t-1/ip-rules/config") return { enabled: true };
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
        <IpRulesPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

const changes = () =>
  vi
    .mocked(api)
    .mock.calls.map(([path, options]) => `${options?.method ?? "GET"} ${path}`)
    .filter((r) => !r.startsWith("GET "));

describe("Threats › IP rules", () => {
  it("says who last changed enforcement, and names each refusal's person and reason", async () => {
    renderPage();
    expect(await screen.findByText(/Last changed by Priya Nair/)).toBeTruthy();
    const refusals = await screen.findByRole("table", { name: "Refused sign-ins" });
    await waitFor(() =>
      expect(within(refusals).getByText("The deny rule 192.0.2.244/30")).toBeTruthy(),
    );
    expect(within(refusals).getByText("Not on an allow rule")).toBeTruthy();
    expect(within(refusals).getByText("Priya Nair")).toBeTruthy();
  });

  it("judges an address against the rules itself while they're off, sending nothing", async () => {
    renderPage();
    await screen.findByText("203.0.113.0/24");
    const field = screen.getByRole("textbox", { name: "Check an address" });
    fireEvent.change(field, { target: { value: "198.51.100.9" } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Would be refused")).toBeTruthy();
    expect(screen.getByText(/No allow rule matches it/)).toBeTruthy();
    expect(vi.mocked(api).mock.calls.some(([path]) => String(path).endsWith("/check"))).toBe(false);
  });

  it("refuses a range it can't read before sending, then adds one without a confirm while off", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add rule" }));
    const range = screen.getByRole("textbox", { name: "Address or range" });
    fireEvent.change(range, { target: { value: "203.0.113.0/33" } });
    fireEvent.submit(range.closest("form") as HTMLFormElement);
    expect(await screen.findByText(/Enter an IP address or a CIDR range/)).toBeTruthy();
    expect(changes()).toEqual([]);

    fireEvent.change(range, { target: { value: "198.51.100.0/24" } });
    fireEvent.submit(range.closest("form") as HTMLFormElement);
    await waitFor(() => expect(changes()).toEqual(["POST /v1/tenants/t-1/ip-rules"]));
    expect(sensitiveCalls.at(-1)?.confirm).toBeUndefined();
  });

  it("asks before turning enforcement on, saying what happens to people", async () => {
    renderPage();
    await screen.findByText("203.0.113.0/24");
    fireEvent.click(screen.getByRole("switch", { name: "Enforce rules" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/for everyone in this organisation/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(changes()).toEqual([]);

    fireEvent.click(screen.getByRole("switch", { name: "Enforce rules" }));
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Turn on" }),
    );
    await waitFor(() => expect(changes()).toEqual(["PUT /v1/tenants/t-1/ip-rules/config"]));
  });

  it("says that removing a rule changes nothing while the rules are off", async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Remove the rule for 192.0.2.244/30" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Nothing changes for anyone now/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove rule" }));
    await waitFor(() => expect(changes()).toEqual(["DELETE /v1/tenants/t-1/ip-rules/r-bad"]));
  });
});
