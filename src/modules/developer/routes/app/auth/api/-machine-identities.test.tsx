// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { SensitiveActionOptions } from "@/platform/security/sensitive-action-provider";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
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
vi.mock("@/shared/hooks/use-create-intent", async (importOriginal) => {
  const { useState } = await import("react");
  return {
    ...(await importOriginal<typeof import("@/shared/hooks/use-create-intent")>()),
    useCreateIntent: () => useState(false),
  };
});

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./machine-identities";

const MachineIdentitiesPage = Route.options.component as () => React.JSX.Element;

const principal = {
  id: "sp-build-bot",
  tenant_id: "tenant-1",
  name: "build-bot",
  scopes: ["user.read"],
  created_at: "2026-09-24T10:15:00Z",
};

let listed: (typeof principal)[];

beforeEach(() => {
  listed = [];
  sensitive.calls = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/tenants/tenant-1/service-principals") return { items: listed };
    if (path === "/v1/service-principals" && options?.method === "POST") {
      return {
        service_principal: principal,
        client_id: "spc_build_bot",
        client_secret: "sp_secret_value",
        warning: "Store the client secret now; it is shown once.",
      };
    }
    if (path === `/v1/service-principals/${principal.id}` && options?.method === "DELETE") {
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
        <MachineIdentitiesPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

async function createIdentity() {
  fireEvent.click(screen.getByRole("button", { name: /new identity/i }));
  fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: "build-bot" } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await screen.findByText("Client credentials for build-bot");
}

describe("Machine identities — creating one", () => {
  it("goes through the sensitive-action path without a confirmation", async () => {
    renderPage();

    await createIdentity();

    expect(sensitive.calls).toHaveLength(1);
    expect(sensitive.calls[0]?.actionLabel).toBe("Create this machine identity");
    expect(sensitive.calls[0]?.confirm).toBeUndefined();
  });

  it("shows the client id and the one-time secret, each with a copy button, until dismissed", async () => {
    renderPage();

    await createIdentity();

    expect(screen.getByText("client_id=spc_build_bot")).toBeTruthy();
    expect(screen.getByText("client_secret=sp_secret_value")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy client_secret=" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("client_secret=sp_secret_value")).toBeNull();
  });
});

describe("Machine identities — disabling one", () => {
  it("disables only after the admin confirms", async () => {
    listed = [principal];
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /disable/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain('Disable "build-bot"?');
    expect(api).not.toHaveBeenCalledWith("/v1/service-principals/sp-build-bot", {
      method: "DELETE",
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Disable" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/v1/service-principals/sp-build-bot", {
        method: "DELETE",
      }),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("Disable this machine identity");
  });
});
