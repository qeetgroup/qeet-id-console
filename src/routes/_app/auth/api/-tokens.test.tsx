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

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./tokens";

const TokensPage = Route.options.component as () => React.JSX.Element;

const grant = {
  id: "grant-1",
  client_id: "client-portal",
  user_id: "user-1",
  user_email: "ada@example.com",
  scopes: ["openid"],
  issued_at: "2026-09-24T10:15:00Z",
  expires_at: "2026-12-24T10:15:00Z",
};

beforeEach(() => {
  sensitive.calls = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/tenants/tenant-1/oauth/grants" && !options?.method) return { items: [grant] };
    if (path === "/v1/tenants/tenant-1/oauth/grants/grant-1" && options?.method === "DELETE") {
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
        <TokensPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

describe("Tokens — revoking an authorization", () => {
  it("revokes only after the admin confirms", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /revoke/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Revoke ada@example.com's grant for client-portal?");
    expect(api).not.toHaveBeenCalledWith(
      "/v1/tenants/tenant-1/oauth/grants/grant-1",
      expect.anything(),
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/v1/tenants/tenant-1/oauth/grants/grant-1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("revoke this authorization");
  });
});
