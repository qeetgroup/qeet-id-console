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
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", mode: "full", can: () => true, canAll: () => true }),
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/auth/api/secrets", searchStr: "", hash: "" }),
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

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { AuthHooksPage } from "../components/auth-hooks/auth-hooks-page";
import { CredentialsPage } from "../components/credentials/credentials-page";
import { SecretsPage } from "../components/secrets/secrets-page";
import { SigningKeysPage } from "../components/signing-keys-page";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const SECRETS = [
  {
    id: "s1",
    name: "STRIPE_SECRET_KEY",
    scope: "payments",
    last4: "9p0L",
    created_at: ago(200),
    updated_at: ago(20),
  },
  {
    id: "s2",
    name: "SLACK_BOT_TOKEN",
    scope: "",
    last4: "",
    created_at: ago(500),
    updated_at: ago(500),
  },
];
const HOOKS = [
  {
    id: "h1",
    trigger: "post_login",
    url: "https://policy.acme.in/qeet/sign-in",
    enabled: true,
    fail_open: true,
    created_at: ago(30),
  },
];
const CREDENTIALS = [
  {
    id: "vc1",
    subject: "did:web:qeet.in:people:qee-1041",
    type: "EmployeeCredential",
    issued_at: ago(10),
    expires_at: ago(-355),
    revoked: false,
  },
  {
    id: "vc2",
    subject: "did:web:qeet.in:people:qee-1002",
    type: "EmployeeCredential",
    issued_at: ago(400),
    expires_at: ago(-10),
    revoked: false,
  },
];
const KEYS = [
  { kid: "b4pa9Bh6XyZ12345", alg: "ES256", use: "sig", status: "candidate" },
  { kid: "TC_Kcb75wQrS6789", alg: "ES256", use: "sig", status: "active" },
  { kid: "old-key-000111", alg: "ES256", use: "sig", status: "retired", retire_at: ago(-12) },
];

let calls: { method: string; path: string; body?: unknown }[];
beforeEach(() => {
  calls = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(
    async (path: string, options?: { method?: string; body?: unknown }) => {
      const method = options?.method ?? "GET";
      calls.push({ method, path, body: options?.body });
      if (method === "GET") {
        if (path === "/v1/tenants/t1/secrets") return { items: SECRETS };
        if (path === "/v1/tenants/t1/auth-hooks") return { items: HOOKS };
        if (path === "/v1/tenants/t1/credentials") return { items: CREDENTIALS };
        if (path === "/v1/oidc/signing-keys") return { keys: KEYS };
      }
      if (method === "POST" && path.endsWith("/reveal")) return { value: "sk_live_revealed" };
      if (method === "POST" && path === "/v1/tenants/t1/credentials")
        return { credential_id: "vc-new", jwt: "eyJ.shown.once", expires_at: ago(-365) };
      if (method !== "GET") return undefined;
      throw new Error(`Unexpected ${method} ${path}`);
    },
  );
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

describe("Secrets", () => {
  it("shows only each value's end, and how it's read", async () => {
    renderWith(<SecretsPage filters={{}} onFiltersChange={vi.fn()} />);
    const table = within(await screen.findByRole("table", { name: "Secrets" }));
    expect(await table.findByText("vault:STRIPE_SECRET_KEY")).toBeTruthy();
    expect(table.getByText("Ends in 9p0L")).toBeTruthy();
    expect(table.queryByText("sk_live_revealed")).toBeNull();
  });

  it("reveals a value through the step-up, then forgets it on Hide", async () => {
    renderWith(<SecretsPage filters={{}} onFiltersChange={vi.fn()} />);
    await screen.findByText("vault:STRIPE_SECRET_KEY");
    fireEvent.click(screen.getByRole("button", { name: /Actions for STRIPE_SECRET_KEY/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Reveal value/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByDisplayValue("sk_live_revealed")).toBeTruthy();
    expect(within(dialog).getByText(/The audit log records it/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hide" }));
    await waitFor(() => expect(screen.queryByDisplayValue("sk_live_revealed")).toBeNull());
  });

  it("deletes only after saying what reads it gets nothing", async () => {
    renderWith(<SecretsPage filters={{}} onFiltersChange={vi.fn()} />);
    await screen.findByText("vault:STRIPE_SECRET_KEY");
    fireEvent.click(screen.getByRole("button", { name: /Actions for STRIPE_SECRET_KEY/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete secret/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/vault:STRIPE_SECRET_KEY get nothing/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete secret" }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === "DELETE" && c.path === "/v1/tenants/t1/secrets/s1"),
      ).toBe(true),
    );
  });
});

describe("Auth hooks", () => {
  it("sends both settings when it changes one (the server reads a missing one as false)", async () => {
    renderWith(<AuthHooksPage />);
    await screen.findByText("policy.acme.in");
    expect(screen.getByText("Allows the sign-in")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Actions for/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Block when it can’t answer/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/nobody can sign in until it’s back/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Block when it can’t answer" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
        enabled: true,
        fail_open: false,
      }),
    );
  });
});

describe("Verifiable credentials", () => {
  it("words each credential's status, and issues one shown once", async () => {
    renderWith(<CredentialsPage filters={{}} onFiltersChange={vi.fn()} />);
    const table = within(await screen.findByRole("table", { name: "Verifiable credentials" }));
    expect(await table.findByText("Valid")).toBeTruthy();
    expect(table.getByText("Expires soon")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /Issue credential/ })[0] as HTMLElement);
    fireEvent.change(await screen.findByLabelText("Subject"), {
      target: { value: "did:web:qeet.in:people:qee-9" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Issue credential$/ }));
    expect(
      await screen.findByText("Copy the credential now. You won't see it again."),
    ).toBeTruthy();
    expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({
      subject: "did:web:qeet.in:people:qee-9",
      type: "EmployeeCredential",
      ttl_seconds: 365 * 86_400,
    });
  });
});

describe("Signing keys", () => {
  it("puts each key in its stage: next, active, retired", async () => {
    renderWith(<SigningKeysPage />);
    await screen.findByRole("heading", { name: "Where each key is" });
    expect(screen.getByText(/It signs nothing yet/)).toBeTruthy();
    expect(screen.getByText(/There is only ever one/)).toBeTruthy();
    expect(screen.getAllByText(/Published until/).length).toBeGreaterThan(0);
    expect(
      within(screen.getByRole("table", { name: "The key set" })).getByText("Next"),
    ).toBeTruthy();
  });
});
