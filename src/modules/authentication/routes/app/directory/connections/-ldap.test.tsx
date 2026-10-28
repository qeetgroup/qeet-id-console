// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("@/platform/components/page-header", () => ({
  PageHeader: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("@/modules/billing", () => ({
  useEntitlements: () => ({ data: undefined }),
  FeatureGate: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
// Records what each action asks the shared sensitive-action runner for, then runs it for real.
const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return (o: Parameters<typeof run>[0]) => {
        sensitiveCalls.push(o);
        return run(o);
      };
    },
  };
});

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./ldap";

const LdapPage = Route.options.component as () => React.JSX.Element;
const LDAP = "/v1/tenants/tenant-1/ldap";

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === LDAP && method === "GET") {
      return {
        items: [
          {
            id: "c1",
            name: "Corp AD",
            server_url: "ldaps://ldap.corp.example.com:636",
            status: "active",
            last_login_at: null,
            created_at: new Date().toISOString(),
          },
        ],
      };
    }
    if (path === LDAP && method === "POST") return { id: "c2" };
    if (path === `${LDAP}/c1` && (method === "PATCH" || method === "DELETE")) return undefined;
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
        <LdapPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function writes() {
  return vi
    .mocked(api)
    .mock.calls.map(([path, options]) => `${options?.method ?? "GET"} ${path}`)
    .filter((r) => !r.startsWith("GET "));
}

describe("Connections › LDAP", () => {
  it("deletes a connection only once the confirmation is accepted", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText('Delete LDAP connection "Corp AD"?')).toBeTruthy();
    expect(writes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(writes()).toEqual([`DELETE ${LDAP}/c1`]));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Delete this LDAP connection" });
  });

  it("keeps the connection when the confirmation is cancelled", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });

  it("disables a connection through the step-up path without a confirmation", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Disable" }));

    await waitFor(() => expect(writes()).toEqual([`PATCH ${LDAP}/c1`]));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Disable this LDAP connection" });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("creates a connection through the step-up path, the submit being the confirmation", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "New connection" }));
    fireEvent.change(await screen.findByLabelText(/^Connection name/), {
      target: { value: "Branch AD" },
    });
    fireEvent.change(screen.getByLabelText(/^Server URL/), {
      target: { value: "ldaps://branch.example.com:636" },
    });
    fireEvent.change(screen.getByLabelText(/^Bind DN \(service account\)/), {
      target: { value: "cn=svc,dc=example,dc=com" },
    });
    fireEvent.change(screen.getByLabelText(/^Bind password/), { target: { value: "secret" } });
    fireEvent.change(screen.getByLabelText(/^User base DN/), {
      target: { value: "ou=People,dc=example,dc=com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create connection" }));

    await waitFor(() => expect(writes()).toEqual([`POST ${LDAP}`]));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Create an LDAP connection" });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});
