// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const sensitiveCalls = vi.hoisted(
  () => [] as { actionLabel?: string; capability?: string; confirm?: unknown }[],
);

vi.mock("@/platform/api/client", () => ({
  api: vi.fn(),
  sessionStore: { getUserId: () => "user-self" },
}));
vi.mock("@/platform/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/auth/session")>()),
  useTenantId: () => "tenant-a",
}));
vi.mock("@/platform/components/page-header", () => ({
  PageHeader: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));
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
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/directory/attribute-mappings" }),
  Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => <a {...props} href={to} />,
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { MappingsPage } from "../components/mappings-page";
import { SuspendedPage } from "../components/suspended-page";

const MAPPINGS = "/v1/tenants/tenant-a/directory/connections/ldap-a/mappings";

const connection = {
  id: "ldap-a",
  name: "Corporate directory",
  reference: "ldap-a",
  type: "ldap",
  status: "active",
  health: "healthy",
  environment: null,
  scope: "users-and-groups",
  created_at: null,
  last_activity_at: null,
  last_sync_at: null,
  user_count: 10,
  group_count: 2,
  server_url: null,
};

const mapping = {
  id: "mapping-a",
  source_attribute: "department",
  target_field: "department",
  value_type: "string",
  transform: "uppercase",
  pattern: "",
  enabled: true,
  required: true,
  version: 1,
};

const suspendedUser = {
  id: "user-a",
  email: "priya@example.test",
  display_name: "Priya Sharma",
  avatar_url: null,
  team: "Engineering",
  reason: "policy_violation",
  source: "manual",
  risk: "high",
  review: "pending",
  suspended_at: "2026-09-10T12:00:00Z",
  last_sign_in: "2026-09-09T12:00:00Z",
  can_manage: true,
};

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/tenant-a/directory/connections") return { items: [connection] };
    if (path === MAPPINGS && method === "GET")
      return { items: [mapping], targets: { department: "string" } };
    if (path.startsWith(`${MAPPINGS}/`)) return method === "DELETE" ? undefined : mapping;
    if (path === "/v1/users/suspended") {
      return {
        items: [suspendedUser],
        total: 1,
        limit: 25,
        offset: 0,
        summary: { total: 1, high_risk: 1, policy: 1, manual: 1, pending: 1 },
        reasons: [{ key: "policy_violation", count: 1 }],
        risks: [{ key: "high", count: 1 }],
        queue: [suspendedUser],
        teams: ["Engineering"],
      };
    }
    if (path === "/v1/users/user-a/reactivate") return undefined;
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});
afterEach(cleanup);

function renderWithProvider(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>{children}</SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function writes() {
  return vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => `${options?.method} ${path}`);
}

describe("Attribute mappings › sensitive actions", () => {
  async function selectRuleAndDelete() {
    fireEvent.click(await screen.findByRole("checkbox", { name: "Select department mapping" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  }

  it("deletes mapping rules only after the destructive confirmation", async () => {
    renderWithProvider(<MappingsPage />);
    await selectRuleAndDelete();

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Delete 1 mapping rules?")).toBeTruthy();
    expect(writes()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(writes()).toEqual([`DELETE ${MAPPINGS}/mapping-a`]));
    expect(sensitiveCalls[0]).toMatchObject({
      capability: "connection.write",
      actionLabel: "delete these mapping rules",
    });
  });

  it("keeps the rules when the deletion is cancelled", async () => {
    renderWithProvider(<MappingsPage />);
    await selectRuleAndDelete();

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });

  it("saves a rule change through the sensitive path without a confirmation", async () => {
    renderWithProvider(<MappingsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Actions for department mapping" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Disable" }));

    await waitFor(() => expect(writes()).toEqual([`PUT ${MAPPINGS}/mapping-a`]));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(sensitiveCalls[0]).toMatchObject({
      capability: "connection.write",
      actionLabel: "save mapping",
    });
  });
});

describe("Suspended users › sensitive actions", () => {
  it("reactivates the selected users after confirmation", async () => {
    renderWithProvider(<SuspendedPage />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Select Priya Sharma" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reactivate 1 selected" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Reactivate 1 users?")).toBeTruthy();
    expect(writes()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Reactivate" }));

    await waitFor(() => expect(writes()).toEqual(["POST /v1/users/user-a/reactivate"]));
    expect(sensitiveCalls[0]).toMatchObject({
      capability: "user.write",
      actionLabel: "reactivate these users",
    });
  });
});
