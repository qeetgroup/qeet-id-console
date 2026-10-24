// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("@/platform/components/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
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
import { Route } from "./index";

const ConnectionsPage = Route.options.component as () => React.JSX.Element;
const LINKS = "/v1/tenants/tenant-1/admin-portal/links";

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === LINKS && method === "GET") {
      return {
        items: [
          {
            id: "l1",
            capabilities: ["saml"],
            expires_at: new Date(Date.now() + 3_600_000).toISOString(),
            created_at: new Date().toISOString(),
            revoked_at: null,
            last_used_at: null,
          },
        ],
      };
    }
    if (path === LINKS && method === "POST") return { id: "l2", url: "https://portal/x" };
    if (path === `${LINKS}/l1` && method === "DELETE") return undefined;
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
        <ConnectionsPage />
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

describe("Connections › Admin portal links", () => {
  it("generates a link through the step-up path without a confirmation", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Generate link" }));

    await waitFor(() => expect(writes()).toEqual([`POST ${LINKS}`]));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Generate an admin portal link" });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("revokes a link only once the confirmation is accepted", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Revoke this admin portal link?")).toBeTruthy();
    expect(writes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(writes()).toEqual([`DELETE ${LINKS}/l1`]));
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "Revoke this admin portal link" });
  });

  it("keeps the link when the confirmation is cancelled", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
    const dialog = await screen.findByRole("alertdialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });
});
