// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
vi.mock("@/platform/components/page-header", () => ({
  PageHeader: ({ actions }: { actions?: ReactNode }) => actions ?? null,
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Records what each sensitive action asked for, then runs it through the real provider.
const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);
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
import { Route } from "./device-authorizations";

const DeviceAuthorizationsPage = Route.options.component as () => React.JSX.Element;

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (method === "GET" && path === "/v1/tenants/t-1/oauth/devices") {
      return {
        items: [
          {
            id: "dev-1",
            client_id: "client-0123456789abcdef",
            user_code: "WDJB-MJHT",
            status: "pending",
            user_id: "",
            user_email: "",
            scopes: ["openid"],
            created_at: "2026-10-20T08:00:00Z",
            expires_at: "2026-10-20T08:15:00Z",
            last_polled_at: null,
          },
        ],
      };
    }
    if (method === "DELETE" && path === "/v1/tenants/t-1/oauth/devices/dev-1") return undefined;
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
        <DeviceAuthorizationsPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function changes() {
  return vi
    .mocked(api)
    .mock.calls.map(([path, options]) => `${options?.method ?? "GET"} ${path}`)
    .filter((r) => !r.startsWith("GET "));
}

async function openConfirmation(): Promise<HTMLElement> {
  await screen.findByText("WDJB-MJHT");
  fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
  const cancel = await screen.findByRole("button", { name: "Cancel" });
  const dialog = cancel.closest('[role="alertdialog"], [role="dialog"]');
  if (!dialog) throw new Error("Confirmation dialog is missing");
  return dialog as HTMLElement;
}

describe("Security › Device authorizations › revoke", () => {
  it("names the user code and confirms through the sensitive-action path", async () => {
    renderPage();
    const dialog = await openConfirmation();

    expect(within(dialog).getByText("Revoke this device authorization?")).toBeTruthy();
    expect(dialog.textContent).toContain("WDJB-MJHT");
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Revoke this device authorization");
    expect(changes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(changes()).toEqual(["DELETE /v1/tenants/t-1/oauth/devices/dev-1"]));
  });

  it("revokes nothing when the confirmation is cancelled", async () => {
    renderPage();
    const dialog = await openConfirmation();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull());
    expect(changes()).toEqual([]);
  });
});
