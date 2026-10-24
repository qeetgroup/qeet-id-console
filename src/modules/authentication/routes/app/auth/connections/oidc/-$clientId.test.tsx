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
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useParams: () => ({ clientId: "cid-app-1" }),
  }),
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => navigate,
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./$clientId";

const OidcClientDetailPage = Route.options.component as () => React.JSX.Element;

const TENANT_CLIENT = "/v1/tenants/tenant-1/oidc/clients/app-1";
const client = {
  id: "app-1",
  tenant_id: "tenant-1",
  client_id: "cid-app-1",
  name: "Admin SPA",
  type: "confidential",
  redirect_uris: ["https://app.example.com/callback"],
  grant_types: ["authorization_code"],
  scopes: ["openid"],
  created_at: "2026-09-24T10:15:00Z",
};

beforeEach(() => {
  sensitive.calls = [];
  navigate.mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/tenants/tenant-1/oidc/clients") return { items: [client] };
    if (path === `${TENANT_CLIENT}/auth-failures`) return { locked_until: null, items: [] };
    if (path === TENANT_CLIENT && options?.method === "PATCH") return client;
    if (path === `${TENANT_CLIENT}/rotate-secret` && options?.method === "POST") {
      return { client_secret: "cs_rotated", warning: "shown once" };
    }
    if (path === "/v1/oidc/clients/app-1" && options?.method === "DELETE") return undefined;
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
});

afterEach(cleanup);

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <SensitiveActionProvider>
        <OidcClientDetailPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function calledWith(path: string, method: string) {
  return vi.mocked(api).mock.calls.some(([p, o]) => p === path && o?.method === method);
}

describe("Application detail — sensitive actions", () => {
  it("saves changes through the sensitive-action path, the submit being the confirmation", async () => {
    renderPage();

    // Save stays off until something changes.
    const save = (await screen.findByRole("button", { name: "Save changes" })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Renamed app" } });
    fireEvent.click(save);

    await waitFor(() => expect(calledWith(TENANT_CLIENT, "PATCH")).toBe(true));
    expect(sensitive.calls[0]?.actionLabel).toBe("Update this application");
    expect(sensitive.calls[0]?.confirm).toBeUndefined();
  });

  it("rotates the secret only after the admin confirms, then shows the new one once", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Rotate secret" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Rotate client secret?");
    expect(calledWith(`${TENANT_CLIENT}/rotate-secret`, "POST")).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "Rotate secret" }));

    expect(await screen.findByText("client_secret=cs_rotated")).toBeTruthy();
    expect(screen.getByText(/can’t be shown again/)).toBeTruthy();
    expect(sensitive.calls[0]?.actionLabel).toBe("Rotate this client secret");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("client_secret=cs_rotated")).toBeNull();
    expect(screen.getByRole("button", { name: "Rotate secret" })).toBeTruthy();
  });

  it("deletes the application only after the admin confirms, then returns to the list", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Delete application" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Apps using the client ID for Admin SPA");
    expect(calledWith("/v1/oidc/clients/app-1", "DELETE")).toBe(false);

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/auth/connections/oidc" }));
    expect(calledWith("/v1/oidc/clients/app-1", "DELETE")).toBe(true);
    expect(sensitive.calls[0]?.actionLabel).toBe("Delete this application");
  });
});
