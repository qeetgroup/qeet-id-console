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
// The page reads its param from its own route.
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: object) => ({
    options,
    useParams: () => ({ groupId: "g-1" }),
  }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./$groupId";

const GroupDetailPage = Route.options.component as () => React.JSX.Element;

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (method === "GET") {
      if (path === "/v1/tenants/t-1/groups") {
        return {
          items: [
            {
              id: "g-1",
              tenant_id: "t-1",
              name: "Engineering",
              description: "",
              created_at: "2026-10-01T00:00:00Z",
            },
          ],
        };
      }
      if (path === "/v1/groups/g-1/members") return { items: [] };
      if (path === "/v1/tenants/t-1/groups/g-1/roles") {
        return { items: [{ role_id: "r-1", name: "editor", granted_at: "2026-10-01T00:00:00Z" }] };
      }
      if (path === "/v1/tenants/t-1/roles") {
        return {
          items: [
            { id: "r-1", name: "editor" },
            { id: "r-2", name: "auditor" },
          ],
        };
      }
    }
    if (path.startsWith("/v1/tenants/t-1/groups/g-1/roles/")) return undefined;
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
        <GroupDetailPage />
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

async function openRemoveConfirm() {
  fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
  return screen.findByRole("alertdialog");
}

describe("Group detail › roles", () => {
  it("grants a role through the step-up path without a confirmation", async () => {
    renderPage();
    await screen.findByText("editor");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Select a role to grant" }), {
      button: 0,
    });
    const option = await screen.findByRole("option", { name: "auditor" });
    fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "Add role" }));

    await waitFor(() => expect(writes()).toEqual(["POST /v1/tenants/t-1/groups/g-1/roles/r-2"]));
    expect(sensitiveCalls).toEqual([
      expect.objectContaining({ actionLabel: "grant this role to the group" }),
    ]);
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("removes a role only after the destructive confirmation names it", async () => {
    renderPage();
    const dialog = await openRemoveConfirm();
    expect(within(dialog).getByText("Remove this role from the group?")).toBeTruthy();
    expect(within(dialog).getByText(/granted by editor/)).toBeTruthy();
    expect(writes()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/tenants/t-1/groups/g-1/roles/r-1"]));
    expect(sensitiveCalls[0]?.actionLabel).toBe("remove this role from the group");
  });

  it("sends nothing when the confirmation is cancelled", async () => {
    renderPage();
    const dialog = await openRemoveConfirm();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });
});
