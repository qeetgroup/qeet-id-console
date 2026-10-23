// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);

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
vi.mock("@/platform/components/page-header", async () => ({
  PageHeader: ({ actions }: { actions?: React.ReactNode }) => <div>{actions}</div>,
}));
vi.mock("@/modules/billing", () => ({
  useEntitlements: () => ({ data: { features: { abac: true } } }),
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
// Editors and previews that need a real browser; the actions under test don't use them.
vi.mock("@/modules/authorization/components/shared/monaco-panel", () => ({
  MonacoPanel: () => null,
}));
vi.mock("@/modules/authorization/components/code-preview/code-preview", () => ({
  CodePreview: () => null,
}));

import type { AbacPolicy } from "@/modules/authorization/api/abac";
import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./abac";

const AbacPage = Route.options.component as () => React.JSX.Element;

const policy: AbacPolicy = {
  id: "p-1",
  tenant_id: "t-1",
  name: "deny_contractors_prod",
  description: "",
  effect: "deny",
  resource_type: "deployment",
  action: "write",
  condition: null,
  priority: 10,
  enabled: true,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/abac/policies" && method === "GET") return { items: [policy] };
    if (path === "/v1/tenants/t-1/abac/policies" && method === "POST") return policy;
    if (path === "/v1/tenants/t-1/abac/policies/p-1" && method === "DELETE") return undefined;
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
        <AbacPage />
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

describe("ABAC › delete a policy", () => {
  it("deletes only after the destructive confirmation, as a sensitive action", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete deny_contractors_prod" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Delete this policy?")).toBeTruthy();
    expect(within(dialog).getByText(/deny_contractors_prod/)).toBeTruthy();
    expect(writes()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete policy" }));

    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/tenants/t-1/abac/policies/p-1"]));
    expect(sensitiveCalls[0]?.actionLabel).toBe("delete this policy");
  });

  it("sends nothing when the confirmation is cancelled", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete deny_contractors_prod" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });
});

describe("ABAC › save a policy", () => {
  it("creates through the step-up path without a confirmation", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /new policy/i }));
    fireEvent.change(await screen.findByLabelText(/^Name\b/), { target: { value: "allow_eng" } });
    fireEvent.click(screen.getByRole("button", { name: "Create policy" }));

    await waitFor(() => expect(writes()).toEqual(["POST /v1/tenants/t-1/abac/policies"]));
    expect(sensitiveCalls).toHaveLength(1);
    expect(sensitiveCalls[0]?.actionLabel).toBe("create this policy");
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});
