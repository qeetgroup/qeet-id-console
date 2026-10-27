// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
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
const router = vi.hoisted(() => ({ navigate: vi.fn(), groupId: "g-1" }));
// The page reads its param from its own route.
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: object) => ({
    options,
    useParams: () => ({ groupId: router.groupId }),
  }),
  useNavigate: () => router.navigate,
  Link: ({
    children,
    to,
    params,
    ...props
  }: React.ComponentProps<"a"> & { to: string; params?: { groupId: string } }) => (
    <a {...props} href={to.replace("$groupId", params?.groupId ?? "")}>
      {children}
    </a>
  ),
}));
vi.mock("@/modules/organizations", () => ({
  useOrgs: () => ({ data: { items: [{ id: "t-1", name: "Qeet Group" }] } }),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./$groupId";

const GroupPage = Route.options.component as () => React.JSX.Element;
const group = (id: string, name: string, parent: string | null, members: number) => ({
  id,
  tenant_id: "t-1",
  parent_id: parent,
  name,
  description: "",
  created_at: "2025-08-18T10:00:00Z",
  member_count: members,
});

beforeEach(() => {
  sensitiveCalls.length = 0;
  router.groupId = "g-1";
  router.navigate.mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (method === "GET") {
      if (path === "/v1/tenants/t-1/groups")
        return {
          items: [
            group("g-1", "Engineering", null, 1),
            group("g-2", "Payments", "g-1", 5),
            group("g-3", "Platform", "g-1", 0),
          ],
        };
      if (path === "/v1/groups/g-1/members")
        return { items: [{ user_id: "u-1", email: "aarav@qeet.in", display_name: "Aarav Mehta" }] };
      if (path === "/v1/tenants/t-1/groups/g-1/roles")
        return { items: [{ role_id: "r-1", name: "editor", granted_at: "2026-10-01T00:00:00Z" }] };
      if (path === "/v1/tenants/t-1/roles")
        return {
          items: [
            { id: "r-1", name: "editor", description: "Edits the content" },
            { id: "r-2", name: "auditor", description: "Reads everything" },
          ],
        };
      if (path === "/v1/users")
        return {
          items: [
            {
              id: "u-1",
              tenant_id: "t-1",
              email: "aarav@qeet.in",
              display_name: "Aarav Mehta",
              status: "active",
              created_at: "2025-08-18T10:00:00Z",
              groups_count: 2,
              metadata: { title: "VP Engineering" },
            },
          ],
        };
    }
    if (path.startsWith("/v1/tenants/t-1/groups/g-1/roles/")) return undefined;
    if (path === "/v1/groups/g-1" && method === "DELETE") return undefined;
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
        <GroupPage />
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

describe("a group's page", () => {
  it("leads with its facts, then where it sits, each group opening its own page", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Engineering", level: 1 })).toBeTruthy();
    expect(await screen.findByText("To its 1 member")).toBeTruthy();
    expect(screen.getByText("2 groups inside it")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Payments, 5 people" }).getAttribute("href")).toBe(
      "/groups/g-2",
    );
    expect(screen.getByRole("link", { name: "Engineering, 6 people, this group" })).toBeTruthy();
    const aarav = (await screen.findByText("Aarav Mehta")).closest("tr") as HTMLElement;
    expect(aarav.textContent).toContain("VP Engineering");
    expect(aarav.textContent).toContain("1 more");
  });

  it("grants a role through the step-up path without a confirmation", async () => {
    renderPage();
    await screen.findByText("Edits the content");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Choose a role" }), { button: 0 });
    const option = await screen.findByRole("option", { name: "auditor" });
    fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "Grant" }));

    await waitFor(() => expect(writes()).toEqual(["POST /v1/tenants/t-1/groups/g-1/roles/r-2"]));
    expect(sensitiveCalls).toEqual([
      expect.objectContaining({ actionLabel: "Grant a role to the group" }),
    ]);
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("stops granting a role only after the confirm says who loses it", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Stop granting editor" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Stop granting editor through Engineering?")).toBeTruthy();
    expect(
      within(dialog).getByText(
        "Its member loses editor, unless another group or their own roles give it to them.",
      ),
    ).toBeTruthy();
    expect(writes()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Stop granting" }));
    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/tenants/t-1/groups/g-1/roles/r-1"]));
  });

  it("sends nothing when the confirmation is cancelled", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Stop granting editor" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });

  it("deletes it and the groups inside it, after saying so, then goes back to Groups", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete Engineering" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain(
      "The 2 groups inside it go too: Payments, Platform. Their members leave them and the roles they grant stop. The people stay in Qeet Group.",
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete 3 groups" }));
    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/groups/g-1"]));
    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith({ to: "/groups" }));
  });

  it("says so when the group isn't there", async () => {
    router.groupId = "gone";
    renderPage();
    expect(await screen.findByText("That group isn't here")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to Groups" }).getAttribute("href")).toBe(
      "/groups",
    );
  });
});
