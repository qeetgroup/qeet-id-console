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
import { Route } from "./gdpr";

const Page = Route.options.component as () => React.JSX.Element;

const REQUEST = {
  id: "purge-1",
  tenant_id: "t-1",
  user_id: "11111111-2222-3333-4444-555555555555",
  reason: "Asked by the person",
  status: "pending",
  grace_until: "2026-11-20T08:00:00Z",
  created_at: "2026-10-20T08:00:00Z",
};

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/gdpr/purge" && method === "GET") return { items: [REQUEST] };
    if (path === "/v1/gdpr/purge" && method === "POST") return REQUEST;
    if (path === "/v1/gdpr/purge/purge-1" && method === "DELETE") return undefined;
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
        <Page />
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

describe("Compliance › GDPR erasure", () => {
  it("files an erasure request as a sensitive action, without a confirmation", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "File erasure request" }));
    fireEvent.change(await screen.findByLabelText(/^User ID/), {
      target: { value: REQUEST.user_id },
    });
    fireEvent.click(screen.getByRole("button", { name: "File request" }));

    await waitFor(() => expect(changes()).toEqual(["POST /v1/gdpr/purge"]));
    expect(sensitiveCalls[0]?.actionLabel).toBe("file an erasure request");
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("cancels a scheduled purge with a plain confirmation, not as a sensitive action", async () => {
    renderPage();
    const row = (await screen.findByText("Asked by the person")).closest("tr");
    if (!row) throw new Error("Request row is missing");
    fireEvent.click(within(row).getByRole("button", { name: "Cancel" }));
    const confirm = await screen.findByRole("button", { name: "Cancel request" });
    expect(changes()).toEqual([]);

    fireEvent.click(confirm);
    await waitFor(() => expect(changes()).toEqual(["DELETE /v1/gdpr/purge/purge-1"]));
    expect(sensitiveCalls).toEqual([]);
  });
});
