// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { SensitiveActionOptions } from "@/platform/security/sensitive-action-provider";

vi.mock("@/platform/api/client", () => ({
  api: vi.fn(),
  getApiBaseUrl: () => "https://api.example.com",
}));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("@/platform/components/page-header", () => ({
  PageHeader: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
// Records each sensitive action's options while the real provider confirms and runs it.
const sensitive = vi.hoisted(() => ({ calls: [] as SensitiveActionOptions<unknown>[] }));
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return <T,>(options: SensitiveActionOptions<T>) => {
        sensitive.calls.push(options);
        return run(options);
      };
    },
  };
});

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./saml-idp";

const SamlIdpPage = Route.options.component as () => React.JSX.Element;

const BASE = "/v1/tenants/tenant-1/saml-providers";
const provider = {
  id: "sp-1",
  tenant_id: "tenant-1",
  name: "Acme Analytics",
  entity_id: "https://analytics.acme.com/saml/metadata",
  acs_url: "https://analytics.acme.com/saml/acs",
  name_id_format: "",
  name_id_attribute: "email",
  certificate: "",
  status: "active",
  created_at: "2026-09-24T10:15:00Z",
  updated_at: "2026-09-24T10:15:00Z",
  last_login_at: null,
};

beforeEach(() => {
  sensitive.calls = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === BASE && !options?.method) return { items: [provider] };
    if (path === BASE && options?.method === "POST") return provider;
    if (path === `${BASE}/sp-1` && options?.method === "PATCH") return provider;
    if (path === `${BASE}/sp-1` && options?.method === "DELETE") return undefined;
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
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
        <SamlIdpPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function calledWith(path: string, method: string) {
  return vi.mocked(api).mock.calls.some(([p, o]) => p === path && o?.method === method);
}

describe("SAML IdP URLs", () => {
  it("shows the organisation's own metadata, entity ID and single sign-on URLs", async () => {
    renderPage();
    await screen.findByText("Acme Analytics");

    for (const url of [
      "https://api.example.com/saml/idp/tenant-1/metadata",
      "https://api.example.com/saml/idp/tenant-1",
      "https://api.example.com/saml/idp/tenant-1/sso",
    ]) {
      expect(screen.getAllByText(url, { exact: true }).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText("https://api.example.com/saml/idp/metadata")).toBeNull();
  });
});

describe("SAML service providers — sensitive actions", () => {
  it("adds a provider through the sensitive-action path, the submit being the confirmation", async () => {
    renderPage();
    await screen.findByText("Acme Analytics");

    fireEvent.click(screen.getByRole("button", { name: "Add service provider" }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText(/^Name\b/), { target: { value: "Beta BI" } });
    fireEvent.change(within(sheet).getByLabelText(/^Entity ID \/ issuer/), {
      target: { value: "https://bi.beta.com/saml" },
    });
    fireEvent.change(within(sheet).getByLabelText(/^ACS URL/), {
      target: { value: "https://bi.beta.com/saml/acs" },
    });
    fireEvent.click(within(sheet).getByRole("button", { name: "Add provider" }));

    await waitFor(() => expect(calledWith(BASE, "POST")).toBe(true));
    expect(sensitive.calls[0]?.actionLabel).toBe("Add this service provider");
    expect(sensitive.calls[0]?.confirm).toBeUndefined();
  });

  it("saves an edit through the sensitive-action path", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /edit/i }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(calledWith(`${BASE}/sp-1`, "PATCH")).toBe(true));
    expect(sensitive.calls[0]?.actionLabel).toBe("Update this service provider");
  });

  it("removes a provider only after the admin confirms", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /remove/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Acme Analytics will no longer accept SSO");
    expect(calledWith(`${BASE}/sp-1`, "DELETE")).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(calledWith(`${BASE}/sp-1`, "DELETE")).toBe(true));
    expect(sensitive.calls[0]?.actionLabel).toBe("Remove this service provider");
  });
});
