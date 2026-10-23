// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);
const intent = vi.hoisted(() => ({ creating: false }));

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
vi.mock("@/platform/components/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/shared/hooks/use-create-intent", async (importOriginal) => {
  const { useState } = await import("react");
  return {
    ...(await importOriginal<typeof import("@/shared/hooks/use-create-intent")>()),
    useCreateIntent: () => useState(intent.creating),
  };
});

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./invitations";

const InvitationsPage = Route.options.component as () => React.JSX.Element;

beforeEach(() => {
  sensitiveCalls.length = 0;
  intent.creating = false;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (method === "GET") {
      if (path === "/v1/tenants") return { items: [{ id: "t-1", name: "Acme" }] };
      if (path === "/v1/tenants/t-1/roles") return { items: [{ id: "r-m", name: "member" }] };
      if (path === "/v1/tenants/t-1/invites") {
        return {
          items: [
            {
              id: "inv-1",
              tenant_id: "t-1",
              email: "ana@example.test",
              role_id: "r-m",
              status: "pending",
              expires_at: "2026-11-01T00:00:00Z",
              created_at: "2026-10-20T00:00:00Z",
            },
          ],
        };
      }
    }
    if (path === "/v1/invites" && method === "POST") return { id: "inv-2" };
    if (path === "/v1/invites/inv-1" && method === "DELETE") return undefined;
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
        <InvitationsPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function writes() {
  return vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => `${options?.method} ${path}`);
}

describe("Invitations › send", () => {
  it("sends the invitation through the step-up path without a confirmation", async () => {
    intent.creating = true;
    renderPage();
    const email = await screen.findByLabelText(/^Email/);
    fireEvent.change(email, { target: { value: "new@example.test" } });
    fireEvent.submit(email.closest("form") as HTMLFormElement);

    await waitFor(() => expect(writes()).toEqual(["POST /v1/invites"]));
    expect(sensitiveCalls).toEqual([
      expect.objectContaining({ actionLabel: "send this invitation" }),
    ]);
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});

describe("Invitations › withdraw", () => {
  it("asks a plain yes/no, not the sensitive-action path", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /revoke/i }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /revoke/i }));

    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/invites/inv-1"]));
    expect(sensitiveCalls).toEqual([]);
  });
});
