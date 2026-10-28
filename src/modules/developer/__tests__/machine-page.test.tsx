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
  useSessionId: () => "s1",
  useMe: () => ({ data: { id: "u-me", email: "priya@qeet.in", display_name: "Priya Nair" } }),
}));
const granted = vi.hoisted(() => ({ except: new Set<string>() }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => {
    const can = (c: string) => !granted.except.has(c);
    return { state: "ready", mode: "full", can, canAll: (cs: string[]) => cs.every(can) };
  },
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/auth/api/keys", searchStr: "", hash: "" }),
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
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
// A native select stands in for the searchable combobox, which jsdom can't drive reliably.
vi.mock("@qeetrix/react/experimental", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@qeetrix/react/experimental")>()),
  Combobox: ({
    items,
    value,
    onValueChange,
    multiple,
  }: {
    items: { label: string; value: string }[];
    value: string[] | string | null;
    onValueChange: (v: string[] | string | null) => void;
    multiple?: boolean;
  }) => (
    <select
      data-testid={multiple ? "scopes" : "person"}
      multiple={multiple}
      value={value ?? (multiple ? [] : "")}
      onChange={(e) =>
        onValueChange(
          multiple ? [...e.target.selectedOptions].map((o) => o.value) : e.target.value || null,
        )
      }
    >
      {items.map((i) => (
        <option key={i.value} value={i.value}>
          {i.label}
        </option>
      ))}
    </select>
  ),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { MachineAccessPage } from "../components/machine/machine-page";
import type { MachineTab } from "../components/machine/machine-tabs";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const KEYS = [
  {
    id: "k1",
    tenant_id: "t1",
    name: "Terraform (prod)",
    prefix: "qk_1FuJQRMX",
    scopes: ["tenant.read", "role.read"],
    last_used_at: ago(0.1),
    created_at: ago(100),
  },
  {
    id: "k2",
    tenant_id: "t1",
    name: "Rohan's CLI",
    prefix: "qk_TvDp9VzV",
    user_id: "u-rohan",
    scopes: ["user.read"],
    expires_at: ago(3),
    created_at: ago(200),
  },
  {
    id: "k3",
    tenant_id: "t1",
    name: "Old probe",
    prefix: "qk_mWMvuq7z",
    scopes: ["tenant.read"],
    revoked_at: ago(30),
    created_at: ago(300),
  },
];
const IDENTITIES = [
  {
    id: "c6c4652b-0000-4000-8000-000000000001",
    tenant_id: "t1",
    name: "qeet-pay-api",
    scopes: ["user.read"],
    created_at: ago(50),
  },
];
const AGENTS = [
  {
    id: "a1",
    name: "Support Copilot",
    scopes: ["user.read"],
    token_ttl_seconds: 600,
    status: "active",
    disabled: false,
    sponsor_user_id: "u-sneha",
    created_at: ago(20),
  },
];
const PEOPLE = [
  {
    id: "u-me",
    tenant_id: "t1",
    email: "priya@qeet.in",
    display_name: "Priya Nair",
    status: "active",
  },
  {
    id: "u-rohan",
    tenant_id: "t1",
    email: "rohan@qeet.in",
    display_name: "Rohan Gupta",
    status: "active",
  },
  {
    id: "u-sneha",
    tenant_id: "t1",
    email: "sneha@qeet.in",
    display_name: "Sneha Kulkarni",
    status: "suspended",
  },
];

let calls: { method: string; path: string; body?: unknown }[];
beforeEach(() => {
  calls = [];
  granted.except = new Set();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(
    async (path: string, options?: { method?: string; body?: unknown }) => {
      const method = options?.method ?? "GET";
      calls.push({ method, path, body: options?.body });
      if (method === "GET") {
        if (path === "/v1/tenants/t1/api-keys") return { items: KEYS };
        if (path === "/v1/tenants/t1/service-principals") return { items: IDENTITIES };
        if (path === "/v1/tenants/t1/agents") return { items: AGENTS };
        if (path === "/v1/users") return { items: PEOPLE, next_cursor: "" };
        if (path === "/v1/tenants/t1/secrets") return { items: [] };
        if (path === "/v1/tenants/t1/oidc/clients/shadow-ai") return { items: [] };
      }
      if (method === "POST" && path === "/v1/api-keys")
        return {
          api_key: {
            ...KEYS[0],
            id: "k-new",
            name: "Zendesk sync",
            prefix: "qk_newnewne",
            expires_at: ago(-90),
          },
          secret: "qk_newnewne.s3cr3t-value",
        };
      if (method === "DELETE" || method === "POST" || method === "PATCH") return undefined;
      throw new Error(`Unexpected ${method} ${path}`);
    },
  );
});
afterEach(cleanup);

function renderPage(tab: MachineTab) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <MachineAccessPage tab={tab} filters={{}} onFiltersChange={vi.fn()} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

const table = () => screen.getByRole("table", { name: /API keys|Machine access|Agents/ });

describe("Machine access", () => {
  it("lists API keys with one status word each and who they belong to", async () => {
    renderPage("key");
    const rows = within(await screen.findByRole("table", { name: "API keys" }));
    expect(await rows.findByText("Terraform (prod)")).toBeTruthy();
    expect(rows.getByText("Expired")).toBeTruthy();
    expect(rows.getByText("Revoked")).toBeTruthy();
    expect(await rows.findByText("Rohan Gupta")).toBeTruthy();
    expect(rows.getAllByText("Organisation").length).toBeGreaterThan(0);
  });

  it("revokes a key after saying anything sending it is refused from its next call", async () => {
    renderPage("key");
    await screen.findByText("Terraform (prod)");
    fireEvent.click(screen.getByRole("button", { name: /Terraform \(prod\)/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Revoke key/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/refused from its next call/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke key" }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "DELETE" && c.path === "/v1/api-keys/k1")).toBe(true),
    );
  });

  it("makes a key with scopes and a 90-day expiry, then shows it once", async () => {
    renderPage("key");
    await screen.findByText("Terraform (prod)");
    fireEvent.click(screen.getAllByRole("button", { name: /New API key/ })[0] as HTMLElement);
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Zendesk sync" } });
    // No scope yet: the drawer says so, and nothing is sent.
    fireEvent.click(screen.getByRole("button", { name: /Create key/ }));
    expect(await screen.findByText("Choose at least one scope.")).toBeTruthy();
    expect(calls.some((c) => c.method === "POST")).toBe(false);

    const scopes = screen.getByTestId("scopes") as HTMLSelectElement;
    for (const o of scopes.options) o.selected = o.value === "user.read";
    fireEvent.change(scopes);
    fireEvent.click(screen.getByRole("button", { name: /Create key/ }));
    expect(await screen.findByText("Copy the key now. You won't see it again.")).toBeTruthy();
    const post = calls.find((c) => c.method === "POST" && c.path === "/v1/api-keys");
    expect(post?.body).toMatchObject({
      tenant_id: "t1",
      name: "Zendesk sync",
      scopes: ["user.read"],
    });
    const expires = Date.parse(
      (post?.body as { expires_at?: string } | undefined)?.expires_at ?? "",
    );
    expect(Math.round((expires - Date.now()) / DAY)).toBe(90);
  });

  it("puts every kind in All, each with its kind", async () => {
    renderPage("all");
    const rows = within(await screen.findByRole("table", { name: "Machine access" }));
    expect(await rows.findByText("qeet-pay-api")).toBeTruthy();
    expect(rows.getByText("Support Copilot")).toBeTruthy();
    expect(rows.getAllByText("API key").length).toBe(3);
    expect(rows.getByText("Machine identity")).toBeTruthy();
    expect(rows.getByText("Agent")).toBeTruthy();
  });

  it("deletes an agent only after saying its tokens are refused and its history stays", async () => {
    renderPage("agent");
    await screen.findByText("Support Copilot");
    expect(table()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Support Copilot/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete agent/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Its audit history stays/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete agent" }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === "DELETE" && c.path === "/v1/tenants/t1/agents/a1"),
      ).toBe(true),
    );
  });

  it("flags an agent whose sponsor is suspended, and suspends every agent at once", async () => {
    renderPage("agent");
    await screen.findByText("Support Copilot");
    expect(await screen.findByText("Sponsor suspended or gone")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Suspend all agents" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend all agents" }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === "POST" && c.path === "/v1/tenants/t1/agents/kill-all"),
      ).toBe(true),
    );
  });

  it("is read-only without apikey.write", async () => {
    granted.except = new Set(["apikey.write"]);
    renderPage("key");
    await screen.findByText("Terraform (prod)");
    expect(screen.queryByRole("button", { name: /New API key/ })).toBeNull();
    expect(screen.getByText(/read-only|read only/i)).toBeTruthy();
  });
});
