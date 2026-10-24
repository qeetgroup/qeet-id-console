// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("@/platform/components/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/modules/qeetai/context/context-registry", () => ({ useRegisterContext: () => {} }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useRouterState: () => "/authorization/roles",
}));

import type { Permission, Role } from "@/modules/authorization/api/rbac";
import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./roles";

const RolesPage = Route.options.component as () => React.JSX.Element;

const role: Role = {
  id: "r-1",
  tenant_id: "t-1",
  name: "editor",
  description: "",
  is_system: false,
  created_at: "2026-10-01T00:00:00Z",
};
const read: Permission = { id: "p-read", key: "doc.read", description: "" };
const write: Permission = { id: "p-write", key: "doc.write", description: "" };

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/roles" && method === "GET") return { items: [role] };
    if (path === "/v1/permissions") return { items: [read, write] };
    if (path === "/v1/roles/r-1/permissions" && method === "GET") return { items: [read] };
    if (path.startsWith("/v1/roles/r-1/permissions/") && method !== "GET") return undefined;
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});
afterEach(cleanup);

async function openPermissions() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <RolesPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Permissions" }));
}

function writes() {
  return vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => `${options?.method} ${path}`);
}

describe("Roles › permission toggles", () => {
  it("grants a permission through the step-up path", async () => {
    await openPermissions();
    fireEvent.click(await screen.findByRole("switch", { name: "Grant doc.write" }));

    await waitFor(() => expect(writes()).toEqual(["POST /v1/roles/r-1/permissions/p-write"]));
    expect(sensitiveCalls).toEqual([
      expect.objectContaining({ actionLabel: "Grant this permission to the role" }),
    ]);
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("revokes a permission through the step-up path", async () => {
    await openPermissions();
    fireEvent.click(await screen.findByRole("switch", { name: "Revoke doc.read" }));

    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/roles/r-1/permissions/p-read"]));
    expect(sensitiveCalls).toEqual([
      expect.objectContaining({ actionLabel: "Revoke this permission from the role" }),
    ]);
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});
