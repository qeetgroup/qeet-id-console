// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
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

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import type { TenantDomain } from "../api/domains";
import { VerifiedDomainsTab } from "../components/verified-domains-tab";

const domain: TenantDomain = {
  id: "d-1",
  domain: "acme.test",
  verification_token: "token",
  dns_record_name: "_qeet.acme.test",
  dns_record_type: "TXT",
  dns_record_value: "qeet-verify=token",
  verified_at: "2026-09-01T00:00:00Z",
  created_at: "2026-09-01T00:00:00Z",
  sso_enabled: false,
  jit_enabled: false,
  is_default: true,
  status: "verified",
};

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/domains" && method === "GET") return { items: [domain] };
    if (path === "/v1/tenants/t-1/domains" && method === "POST") return domain;
    if (path === "/v1/tenants/t-1/domains/d-1") return method === "DELETE" ? undefined : domain;
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});
afterEach(cleanup);

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <VerifiedDomainsTab />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

async function chooseAction(name: string) {
  await screen.findByText("acme.test");
  fireEvent.click(screen.getByRole("button", { name: "Actions" }));
  fireEvent.click(await screen.findByRole("menuitem", { name }));
}

function writes() {
  return vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => ({ path, method: options?.method, body: options?.body }));
}

describe("Verified domains › sensitive actions", () => {
  it("adds a domain through the sensitive path, the submit being the confirmation", async () => {
    renderTab();
    const input = await screen.findByRole("textbox", { name: "Add a domain" });
    fireEvent.change(input, { target: { value: "example.test" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() =>
      expect(writes()).toEqual([
        { path: "/v1/tenants/t-1/domains", method: "POST", body: { domain: "example.test" } },
      ]),
    );
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(""));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Add a domain" });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("changes a domain's settings through the sensitive path without a confirmation", async () => {
    renderTab();
    await chooseAction("Toggle SSO eligibility");

    await waitFor(() =>
      expect(writes()).toEqual([
        { path: "/v1/tenants/t-1/domains/d-1", method: "PATCH", body: { sso_enabled: true } },
      ]),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Change this domain's settings" });
  });

  it("removes a domain only after the destructive confirmation", async () => {
    renderTab();
    await chooseAction("Remove domain");

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Remove this domain?")).toBeTruthy();
    expect(within(dialog).getByText(/acme\.test will no longer route sign-ins/)).toBeTruthy();
    expect(writes()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove domain" }));

    await waitFor(() =>
      expect(writes()).toEqual([
        { path: "/v1/tenants/t-1/domains/d-1", method: "DELETE", body: undefined },
      ]),
    );
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Remove domain" });
  });

  it("keeps the domain when the removal is cancelled", async () => {
    renderTab();
    await chooseAction("Remove domain");

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });
});
