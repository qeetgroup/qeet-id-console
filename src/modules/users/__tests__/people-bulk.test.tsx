// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const context = vi.hoisted(() => ({ tenantId: "tenant-a" as string | null }));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => context.tenantId }));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("@/modules/authorization", () => ({
  useRoles: () => ({
    data: {
      items: [
        { id: "role-admin", name: "Admin" },
        { id: "role-viewer", name: "Viewer" },
      ],
    },
  }),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import * as dataExport from "@/shared/utils/data-export";
import { userKeys } from "../api/keys";
import type { User } from "../api/users";
import { PeopleBulkActions } from "../components/people/people-bulk";

const USERS_LIST: QueryKey = userKeys.list("tenant-a", { limit: 25, offset: 0 });
const USER_STATS: QueryKey = userKeys.stats("tenant-a");

function user(id: string, overrides: Partial<User> = {}): User {
  return {
    id,
    tenant_id: "tenant-a",
    email: `${id}@example.test`,
    status: "active",
    created_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function users(count: number) {
  return Array.from({ length: count }, (_, i) => user(`user-${i + 1}`));
}

function renderBulk(
  selected: User[],
  tenantId: string | null = "tenant-a",
  currentUserId: string | null = "someone-else",
) {
  context.tenantId = tenantId;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  for (const key of [USERS_LIST, USER_STATS]) client.setQueryData(key, { seeded: true });
  const onDone = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <SensitiveActionProvider>
        <PeopleBulkActions selected={selected} currentUserId={currentUserId} onDone={onDone} />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
  return { client, onDone };
}

function invalidated(client: QueryClient, key: QueryKey) {
  return client.getQueryState(key)?.isInvalidated === true;
}

/** Returns the api() calls other than the groups read, in the order they were sent. */
function actionCalls() {
  return vi
    .mocked(api)
    .mock.calls.filter(([path]) => !path.endsWith("/groups"))
    .map(([path, opts]) => [path, opts]);
}

let success: ReturnType<typeof vi.spyOn>;
let warning: ReturnType<typeof vi.spyOn>;
let failure: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path) =>
    path === "/v1/tenants/tenant-a/groups"
      ? { items: [{ id: "grp-eng", name: "Engineering" }] }
      : undefined,
  );
  success = vi.spyOn(toast, "success").mockImplementation(() => "");
  warning = vi.spyOn(toast, "warning").mockImplementation(() => "");
  failure = vi.spyOn(toast, "error").mockImplementation(() => "");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PeopleBulkActions", () => {
  it("requires two-step for every selected user, then reports, refreshes and clears the selection", async () => {
    const { client, onDone } = renderBulk(users(3));

    fireEvent.click(screen.getByRole("button", { name: "Require two-step (3)" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(actionCalls()).toEqual(
      ["user-1", "user-2", "user-3"].map((id) => [
        `/v1/users/${id}/mfa-required`,
        { method: "PUT", body: { required: true } },
      ]),
    );
    expect(success).toHaveBeenCalledWith("Updated 3 users");
    expect(invalidated(client, USERS_LIST)).toBe(true);
    expect(invalidated(client, USER_STATS)).toBe(true);
  });

  it("sends at most five requests at a time and shows progress while it runs", async () => {
    const pending: Array<() => void> = [];
    vi.mocked(api).mockImplementation((path) =>
      path.endsWith("/groups")
        ? Promise.resolve({ items: [] })
        : new Promise((resolve) => pending.push(() => resolve(undefined))),
    );
    const { onDone } = renderBulk(users(7));

    fireEvent.click(screen.getByRole("button", { name: "Require two-step (7)" }));

    expect(await screen.findByText("Require two-step verification · 0 of 7")).toBeTruthy();
    await waitFor(() => expect(pending).toHaveLength(5));

    pending[0]?.();
    expect(await screen.findByText("Require two-step verification · 1 of 7")).toBeTruthy();
    await waitFor(() => expect(pending).toHaveLength(6));

    for (const resolve of pending.slice(1)) resolve();
    await waitFor(() => expect(pending).toHaveLength(7));
    pending[6]?.();

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(success).toHaveBeenCalledWith("Updated 7 users");
  });

  it("suspends the selected users only after confirmation, and reports a partial failure", async () => {
    vi.mocked(api).mockImplementation(async (path) => {
      if (path.endsWith("/groups")) return { items: [] };
      if (path === "/v1/users/user-2") throw new Error("refused");
      return undefined;
    });
    const { client, onDone } = renderBulk(users(3));

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Suspend user" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Suspend 3 users?");
    expect(actionCalls()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend user" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(actionCalls()).toEqual(
      ["user-1", "user-2", "user-3"].map((id) => [
        `/v1/users/${id}`,
        { method: "PATCH", body: { status: "suspended" } },
      ]),
    );
    expect(warning).toHaveBeenCalledWith("Updated 2, failed 1");
    // Something may have changed, so the views are refreshed anyway.
    expect(invalidated(client, USERS_LIST)).toBe(true);
  });

  it("reports when every request failed", async () => {
    vi.mocked(api).mockImplementation(async (path) => {
      if (path.endsWith("/groups")) return { items: [] };
      throw new Error("refused");
    });
    const { onDone } = renderBulk(users(2));

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out everywhere" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Revoke sessions for 2 users?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Revoke all" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(actionCalls().map(([path]) => path)).toEqual([
      "/v1/users/user-1/sessions/revoke-all",
      "/v1/users/user-2/sessions/revoke-all",
    ]);
    expect(failure).toHaveBeenCalledWith("Failed on 2 users");
  });

  it("sends nothing when a confirmation is cancelled", async () => {
    const { onDone } = renderBulk(users(2));

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Suspend user" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(actionCalls()).toEqual([]);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("opens the role picker and assigns the chosen role to every selected user", async () => {
    const { onDone } = renderBulk(users(2));

    fireEvent.click(screen.getByRole("button", { name: "Assign a role" }));
    expect(await screen.findByText("Assign which role?")).toBeTruthy();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Viewer" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(actionCalls()).toEqual([
      ["/v1/users/user-1/tenants/tenant-a/roles/role-viewer", { method: "POST" }],
      ["/v1/users/user-2/tenants/tenant-a/roles/role-viewer", { method: "POST" }],
    ]);
    expect(success).toHaveBeenCalledWith("Updated 2 users");
  });

  it("offers no role to assign when no tenant is selected", async () => {
    const { onDone } = renderBulk(users(2), null);

    fireEvent.click(screen.getByRole("button", { name: "Assign a role" }));
    const viewer = await screen.findByRole("menuitem", { name: "Viewer" });
    expect(viewer.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(viewer);

    expect(onDone).not.toHaveBeenCalled();
    expect(actionCalls()).toEqual([]);
  });

  it("opens the group picker and adds every selected user to the chosen group", async () => {
    const { onDone } = renderBulk(users(2));

    fireEvent.click(screen.getByRole("button", { name: "Add to a group" }));
    expect(await screen.findByText("Add to which group?")).toBeTruthy();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Engineering" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(actionCalls()).toEqual([
      ["/v1/groups/grp-eng/members/user-1", { method: "POST" }],
      ["/v1/groups/grp-eng/members/user-2", { method: "POST" }],
    ]);
    expect(success).toHaveBeenCalledWith("Updated 2 users");
  });

  it("reads the tenant's groups when the group picker opens, not before", async () => {
    renderBulk(users(1));
    expect(api).not.toHaveBeenCalledWith("/v1/tenants/tenant-a/groups");

    fireEvent.click(screen.getByRole("button", { name: "Add to a group" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/v1/tenants/tenant-a/groups"));
  });

  it("deletes the selected users only after confirmation", async () => {
    const { onDone } = renderBulk(users(2));

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete user" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Delete 2 users? This can’t be undone.");
    expect(actionCalls()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(actionCalls()).toEqual([
      ["/v1/users/user-1", { method: "DELETE" }],
      ["/v1/users/user-2", { method: "DELETE" }],
    ]);
  });

  it("exports the selection as CSV with roles and MFA flattened into text", async () => {
    const exportCsv = vi.spyOn(dataExport, "exportToCsv").mockImplementation(() => {});
    const selected = [
      user("user-1", {
        display_name: "Asha",
        roles: ["admin", "viewer"],
        mfa_enabled: true,
        last_seen_at: "2026-10-20T00:00:00Z",
      }),
      user("user-2", { roles: null, mfa_enabled: undefined, last_seen_at: null }),
    ];
    renderBulk(selected);

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Export CSV" }));

    expect(exportCsv).toHaveBeenCalledTimes(1);
    const [name, rows, columns] = exportCsv.mock.calls[0] ?? [];
    assert(columns, "expected CSV columns");
    expect(name).toBe("users");
    expect(rows).toBe(selected);
    expect(dataExport.rowsToCsv(selected, columns).split("\n")).toEqual([
      "id,email,display_name,status,roles,mfa_enabled,last_seen_at,created_at",
      "user-1,user-1@example.test,Asha,active,admin|viewer,true,2026-10-20T00:00:00Z,2026-09-01T00:00:00Z",
      "user-2,user-2@example.test,,active,,,,2026-09-01T00:00:00Z",
    ]);
  });

  it("leaves the person using the console out of signing out, suspending and deleting", async () => {
    const { onDone } = renderBulk(users(3), "tenant-a", "user-2");

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Suspend user" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Suspend 2 users?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend user" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(actionCalls().map(([path]) => path)).toEqual(["/v1/users/user-1", "/v1/users/user-3"]);
  });

  it("can't take access away when only the person using the console is selected", async () => {
    renderBulk(users(1), "tenant-a", "user-1");

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    for (const name of ["Sign out everywhere", "Suspend user", "Delete user"]) {
      const item = await screen.findByRole("menuitem", { name });
      expect(item.getAttribute("aria-disabled")).toBe("true");
    }
  });

  it("exports the selection as JSON", async () => {
    const exportJson = vi.spyOn(dataExport, "exportToJson").mockImplementation(() => {});
    const selected = users(2);
    renderBulk(selected);

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Export JSON" }));

    expect(exportJson).toHaveBeenCalledWith("users", selected);
  });
});
