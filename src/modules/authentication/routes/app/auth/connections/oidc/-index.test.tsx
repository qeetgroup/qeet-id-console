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
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/shared/hooks/use-create-intent", async (importOriginal) => {
  const { useState } = await import("react");
  return {
    ...(await importOriginal<typeof import("@/shared/hooks/use-create-intent")>()),
    useCreateIntent: () => useState(false),
  };
});

import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./index";

const OidcPage = Route.options.component as () => React.JSX.Element;

function app(id: string, name: string, type: "public" | "confidential" = "confidential") {
  return {
    id,
    tenant_id: "tenant-1",
    client_id: `cid-${id}`,
    name,
    type,
    redirect_uris: ["https://app.example.com/callback"],
    grant_types: ["authorization_code"],
    scopes: ["openid"],
    created_at: "2026-09-24T10:15:00Z",
  };
}

let created: { client: ReturnType<typeof app>; client_secret: string };
let deleteFailure: Error | undefined;

beforeEach(() => {
  created = { client: app("app-3", "Billing portal"), client_secret: "cs_once" };
  deleteFailure = undefined;
  sensitive.calls = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/tenants/tenant-1/oidc/clients") {
      return { items: [app("app-1", "Admin SPA"), app("app-2", "Support desk")] };
    }
    if (path === "/v1/oidc/clients" && options?.method === "POST") {
      return { ...created, warning: "shown once" };
    }
    if (path.startsWith("/v1/oidc/clients/") && options?.method === "DELETE") {
      if (deleteFailure) throw deleteFailure;
      return undefined;
    }
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
        <OidcPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function deletes() {
  return vi
    .mocked(api)
    .mock.calls.filter(([, o]) => o?.method === "DELETE")
    .map(([p]) => p);
}

async function register() {
  await screen.findByRole("checkbox", { name: "Select Admin SPA" });
  fireEvent.click(screen.getByRole("button", { name: "Register application" }));
  const sheet = await screen.findByRole("dialog");
  fireEvent.change(within(sheet).getByLabelText(/^Name/), { target: { value: "Billing portal" } });
  fireEvent.change(within(sheet).getByLabelText(/^Redirect URIs/), {
    target: { value: "https://billing.example.com/callback" },
  });
  fireEvent.click(within(sheet).getByRole("button", { name: "Register application" }));
}

describe("Applications — registering one", () => {
  it("registers through the sensitive-action path, the submit being the confirmation", async () => {
    renderPage();

    await register();

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/v1/oidc/clients",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("Register this application");
    expect(sensitive.calls[0]?.confirm).toBeUndefined();
  });

  it("shows a confidential app's id and secret once, with the quickstart, until dismissed", async () => {
    renderPage();

    await register();

    expect(await screen.findByText("client_secret=cs_once")).toBeTruthy();
    expect(screen.getByText("client_id=cid-app-3")).toBeTruthy();
    expect(screen.getByText("Client credentials for Billing portal")).toBeTruthy();
    expect(screen.getByText("Integrate this application")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("client_secret=cs_once")).toBeNull();
  });

  it("shows only the quickstart for a public app, which has no secret", async () => {
    created = { client: app("app-3", "Billing portal", "public"), client_secret: "" };
    renderPage();

    await register();

    expect(await screen.findByText("Integrate this application")).toBeTruthy();
    expect(screen.queryByText(/client_secret=/)).toBeNull();
  });
});

describe("Applications — deleting them", () => {
  it("deletes one only after the admin confirms", async () => {
    renderPage();
    await screen.findByRole("checkbox", { name: "Select Admin SPA" });

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0] as HTMLElement);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Apps using the client ID for Admin SPA");
    expect(deletes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deletes()).toEqual(["/v1/oidc/clients/app-1"]));
    expect(sensitive.calls[0]?.actionLabel).toBe("Delete this application");
    expect(sensitive.calls[0]?.capability).toBe("connection.write");
  });

  it("deletes a selection only after the admin confirms", async () => {
    renderPage();
    await screen.findByRole("checkbox", { name: "Select Admin SPA" });

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Admin SPA" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Support desk" }));
    fireEvent.click(screen.getByRole("button", { name: /delete selected/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Delete 2 applications?");
    expect(deletes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(deletes()).toEqual(["/v1/oidc/clients/app-1", "/v1/oidc/clients/app-2"]),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("Delete these applications");
  });

  it("stops a bulk delete when the step-up is refused, rather than asking for every app", async () => {
    deleteFailure = new ApiError(403, "step_up_required", "Step-up required");
    renderPage();
    await screen.findByRole("checkbox", { name: "Select Admin SPA" });

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Admin SPA" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Support desk" }));
    fireEvent.click(screen.getByRole("button", { name: /delete selected/i }));
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );

    await waitFor(() => expect(deletes()).toEqual(["/v1/oidc/clients/app-1"]));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /delete selected/i }).hasAttribute("disabled"),
      ).toBe(false),
    );
    expect(deletes()).toEqual(["/v1/oidc/clients/app-1"]);
  });
});
