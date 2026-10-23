// @vitest-environment jsdom
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

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { NewGroupSheet } from "../components/new-group-sheet";

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/roles" && method === "GET") {
      return { items: [{ id: "r-1", name: "editor" }] };
    }
    if (path === "/v1/groups" && method === "POST") return { id: "g-new", name: "Engineering" };
    if (path === "/v1/tenants/t-1/groups/g-new/roles/r-1" && method === "POST") return undefined;
    throw new Error(`Unexpected request ${method} ${path}`);
  });
});
afterEach(cleanup);

function writes() {
  return vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => `${options?.method} ${path}`);
}

describe("New group sheet › default role", () => {
  it("creates the group, then grants its role through the step-up path", async () => {
    const onOpenChange = vi.fn();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <SensitiveActionProvider>
          <NewGroupSheet open onOpenChange={onOpenChange} groups={[]} users={[]} />
        </SensitiveActionProvider>
      </QueryClientProvider>,
    );

    const name = await screen.findByLabelText(/^Name/);
    fireEvent.change(name, { target: { value: "Engineering" } });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Default role assignment" }), {
      button: 0,
    });
    const option = await screen.findByRole("option", { name: "editor" });
    fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
    fireEvent.click(option);
    fireEvent.submit(name.closest("form") as HTMLFormElement);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(writes()).toEqual(["POST /v1/groups", "POST /v1/tenants/t-1/groups/g-new/roles/r-1"]);
    // Only the role grant is sensitive; creating the group is not step-up gated.
    expect(sensitiveCalls).toEqual([
      expect.objectContaining({ actionLabel: "grant the default role to the new group" }),
    ]);
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});
