// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn(), getApiBaseUrl: () => "" }));
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
import { Route } from "./saml";

const SamlPage = Route.options.component as () => React.JSX.Element;
const SAML = "/v1/tenants/tenant-1/saml";

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === SAML && method === "GET") {
      const now = new Date().toISOString();
      return {
        items: [
          {
            id: "s1",
            tenant_id: "tenant-1",
            name: "Okta prod",
            idp_entity_id: "http://www.okta.com/exk1",
            idp_sso_url: "https://example.okta.com/app/sso/saml",
            idp_certificate: "MIIC",
            email_attribute: "",
            name_attribute: "",
            status: "active",
            created_at: now,
            updated_at: now,
            last_login_at: null,
          },
        ],
      };
    }
    if (path === SAML && method === "POST") return { id: "s2" };
    if (path === `${SAML}/s1` && (method === "PATCH" || method === "DELETE")) return undefined;
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
        <SamlPage />
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

describe("Connections › SAML", () => {
  it("deletes a connection only once the confirmation is accepted", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText('Delete SAML connection "Okta prod"?')).toBeTruthy();
    expect(writes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(writes()).toEqual([`DELETE ${SAML}/s1`]));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "delete this SAML connection" });
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

    await waitFor(() => expect(writes()).toEqual([`PATCH ${SAML}/s1`]));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "disable this SAML connection" });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("creates a connection through the step-up path, the submit being the confirmation", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "New connection" }));
    fireEvent.change(await screen.findByLabelText(/^Connection name/), {
      target: { value: "Entra" },
    });
    fireEvent.change(screen.getByLabelText(/^IdP entity ID \/ issuer/), {
      target: { value: "https://sts.windows.net/abc/" },
    });
    fireEvent.change(screen.getByLabelText(/^IdP SSO URL/), {
      target: { value: "https://login.microsoftonline.com/abc/saml2" },
    });
    fireEvent.change(screen.getByLabelText(/^IdP signing certificate/), {
      target: { value: "MIIC" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create connection" }));

    await waitFor(() => expect(writes()).toEqual([`POST ${SAML}`]));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "create a SAML connection" });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});
