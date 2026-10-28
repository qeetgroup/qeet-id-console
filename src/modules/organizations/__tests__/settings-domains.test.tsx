// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);
const state = vi.hoisted(() => ({
  login: null as unknown,
  branding: {} as Record<string, unknown>,
}));

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
vi.mock("@/modules/dashboard", () => ({ PageBreadcrumb: () => null }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
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
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a {...props} href={to} />,
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import type { LoginDomainStatus, TenantDomain } from "../api/domains";
import { DomainsPage } from "../components/settings/domains-page";
import { checkDomain, loginRecords } from "../components/settings/domains-model";

const verified: TenantDomain = {
  id: "d-1",
  domain: "acme.test",
  verification_token: "qeet-verify-1",
  dns_record_name: "_qeet-verification.acme.test",
  dns_record_type: "TXT",
  dns_record_value: "qeet-verify-1",
  verified_at: "2026-09-01T00:00:00Z",
  created_at: "2026-09-01T00:00:00Z",
  sso_enabled: true,
  jit_enabled: false,
  is_default: true,
  status: "verified",
};
const pending: TenantDomain = {
  ...verified,
  id: "d-2",
  domain: "acme.dev",
  dns_record_name: "_qeet-verification.acme.dev",
  dns_record_value: "qeet-verify-2",
  verified_at: null,
  last_checked_at: "2026-10-01T00:00:00Z",
  last_error: "DNS TXT record not found",
  status: "attention",
};
const noAddress: LoginDomainStatus = {
  login_domain: "",
  status: "not_configured",
  dns_verified: false,
  dns_detail: "No custom login domain configured.",
  tls_state: "not_started",
  tls_detail: "",
  endpoint_state: "not_available",
  records: [],
};

beforeEach(() => {
  sensitiveCalls.length = 0;
  state.login = noAddress;
  state.branding = { tenant_id: "t-1", primary_color: "#112233", custom_domain: null };
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1") return { id: "t-1", name: "Acme" };
    if (path === "/v1/tenants/t-1/domains" && method === "GET")
      return { items: [verified, pending] };
    if (path === "/v1/tenants/t-1/domains" && method === "POST")
      return { ...pending, id: "d-3", domain: "acme.io", status: "pending", last_error: "" };
    if (path === "/v1/tenants/t-1/domains/d-1" && method === "DELETE") return undefined;
    if (path === "/v1/tenants/t-1/domains/d-2/verify") return { ...pending, status: "verified" };
    if (path === "/v1/tenants/t-1/login-domain") return state.login;
    if (path === "/v1/tenants/t-1/branding")
      return method === "PUT" ? options?.body : state.branding;
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
        <DomainsPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

const writes = () =>
  vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => ({ path, method: options?.method, body: options?.body }));

describe("Settings › Domains › email domains", () => {
  it("lists each domain with its state, and no switches the server doesn't use", async () => {
    renderPage();
    expect(await screen.findByText("acme.test")).toBeTruthy();
    expect(screen.getByText("Verified")).toBeTruthy();
    expect(screen.getByText("Check failed")).toBeTruthy();
    expect(screen.getByText("The last check didn't find its TXT record.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Manage acme.test" }));
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByText("Default")).toBeNull();
    expect(screen.getByText("_qeet-verification.acme.test")).toBeTruthy();
    // Verified once: there's nothing to check again.
    expect(screen.queryByRole("button", { name: "Check now" })).toBeNull();
  });

  it("checks a domain's record when asked, without a second step", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Manage acme.dev" }));
    fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    await waitFor(() =>
      expect(writes()).toEqual([
        { path: "/v1/tenants/t-1/domains/d-2/verify", method: "POST", body: undefined },
      ]),
    );
    expect(sensitiveCalls).toEqual([]);
  });

  it("adds a domain as the server will keep it, then opens it with its record", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add domain" }));
    const field = screen.getByRole("textbox", { name: "Domain" });
    fireEvent.change(field, { target: { value: "https://ACME.io/" } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);

    await waitFor(() =>
      expect(writes()).toEqual([
        { path: "/v1/tenants/t-1/domains", method: "POST", body: { domain: "acme.io" } },
      ]),
    );
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Add a domain" });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("refuses a name that isn't a domain before sending it", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add domain" }));
    const field = screen.getByRole("textbox", { name: "Domain" });
    fireEvent.change(field, { target: { value: "localhost" } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);
    expect(await screen.findByText("Enter a domain, such as qeet.co.in.")).toBeTruthy();
    expect(writes()).toEqual([]);
  });

  it("removes a verified domain only after a confirm that says what happens to accounts", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Manage acme.test" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove domain" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Remove acme.test?")).toBeTruthy();
    expect(
      within(dialog).getByText(/Acme stops managing the accounts on @acme\.test/),
    ).toBeTruthy();
    expect(writes()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove domain" }));
    await waitFor(() =>
      expect(writes()).toEqual([
        { path: "/v1/tenants/t-1/domains/d-1", method: "DELETE", body: undefined },
      ]),
    );
  });

  it("keeps the domain when the removal is cancelled", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Manage acme.test" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove domain" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });
});

describe("Settings › Domains › sign-in address", () => {
  it("saves a new address onto the rest of the branding", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Set up" }));
    const field = screen.getByRole("textbox", { name: "Address" });
    fireEvent.change(field, { target: { value: "Auth.Acme.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    await waitFor(() =>
      expect(writes()).toEqual([
        {
          path: "/v1/tenants/t-1/branding",
          method: "PUT",
          body: { tenant_id: "t-1", primary_color: "#112233", custom_domain: "auth.acme.test" },
        },
      ]),
    );
  });

  it("shows the records to publish while it waits for them, each named in full", async () => {
    state.login = {
      ...noAddress,
      login_domain: "auth.acme.test",
      status: "pending",
      records: [
        { type: "CNAME", name: "auth.acme.test", value: "22222222.tenants.id.qeet.in" },
        { type: "TXT", name: "_qeetid-verify", value: "qeetid-verify=22222222" },
      ],
    };
    renderPage();
    expect(await screen.findByText("Setting up")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    expect(screen.getByText("_qeetid-verify.auth.acme.test")).toBeTruthy();
    expect(screen.getByText("22222222.tenants.id.qeet.in")).toBeTruthy();
  });

  it("says it's live once every step is done", async () => {
    state.login = {
      ...noAddress,
      login_domain: "auth.acme.test",
      status: "active",
      dns_verified: true,
      tls_state: "issued",
      endpoint_state: "live",
      endpoint_url: "https://auth.acme.test",
      records: [],
    };
    renderPage();
    expect(await screen.findByText("Live")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    expect(screen.getByText("People sign in at https://auth.acme.test.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Check again" })).toBeNull();
  });
});

describe("Domain names", () => {
  it("are kept as the server keeps them", () => {
    expect(checkDomain(" https://Acme.COM/path ")).toBe("acme.com");
    expect(checkDomain("acme.com.")).toBe("acme.com");
    expect(checkDomain("acme")).toBeNull();
    expect(checkDomain("ac me.com")).toBeNull();
    expect(checkDomain("-acme.com")).toBeNull();
  });

  it("name the sign-in address's TXT record where the server looks it up", () => {
    expect(
      loginRecords({
        ...noAddress,
        login_domain: "auth.acme.test",
        records: [
          { type: "CNAME", name: "auth.acme.test", value: "x" },
          { type: "TXT", name: "_qeetid-verify", value: "y" },
        ],
      }).map((record) => record.name),
    ).toEqual(["auth.acme.test", "_qeetid-verify.auth.acme.test"]);
  });
});
