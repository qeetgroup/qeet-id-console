// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);

vi.mock("@/platform/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/api/client")>()),
  api: vi.fn(),
}));
vi.mock("@/platform/auth/session", () => ({
  useTenantId: () => "t-1",
  useUserId: () => "u-me",
  useSessionId: () => "s-1",
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", mode: "full", can: () => true, canAll: () => true }),
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
  useLocation: () => ({ pathname: "/authorization/rebac", searchStr: "", hash: "" }),
  useNavigate: () => vi.fn(),
  Link: ({
    to,
    children,
    ...props
  }: ComponentProps<"a"> & { to: string; children?: ReactNode }) => (
    <a {...props} href={to}>
      {children}
    </a>
  ),
}));

import { RebacPage } from "@/modules/authorization/pages";
import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";

const GRACE = "7f0e2a1c-0000-4000-8000-000000000001";
const tuples = [
  { id: "tu-1", object: "document:readme", relation: "viewer", subject: `user:${GRACE}` },
  { id: "tu-2", object: "document:readme", relation: "viewer", subject: "group:pm#member" },
];

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    const query = (options?.query ?? {}) as Record<string, unknown>;
    if (path === "/v1/tenants/t-1/relation-tuples/graph")
      return {
        nodes: [
          { id: "document:readme", type: "document", label: "readme" },
          { id: `user:${GRACE}`, type: "user", label: GRACE },
          { id: "group:pm", type: "group", label: "pm" },
        ],
        edges: [
          { from: "document:readme", to: `user:${GRACE}`, relation: "viewer" },
          { from: "document:readme", to: "group:pm", relation: "viewer → member" },
        ],
      };
    if (path === "/v1/tenants/t-1/relation-tuples" && method === "GET")
      return { items: query.object ? tuples : [] };
    if (path === "/v1/tenants/t-1/relation-tuples" && method === "POST")
      return { id: "tu-3", ...(options?.body as object) };
    if (path === "/v1/tenants/t-1/relation-tuples/tu-1" && method === "DELETE") return undefined;
    if (path === "/v1/users")
      return {
        items: [
          {
            id: GRACE,
            tenant_id: "t-1",
            email: "grace@qeet.in",
            display_name: "Grace Okafor",
            status: "active",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      };
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
        <RebacPage object="document:readme" onOpen={vi.fn()} />
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

describe("ReBAC › the object's relationships", () => {
  it("names people in the tuples and draws the graph", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "Tuples on document:readme" });
    expect(await within(table).findByText("Grace Okafor")).toBeTruthy();
    expect(within(table).getByText("group:pm#member")).toBeTruthy();
    expect(
      await screen.findByRole("figure", { name: "Who reaches document:readme as viewer" }),
    ).toBeTruthy();
  });

  it("deletes a relationship only after the destructive confirmation", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "Tuples on document:readme" });
    await within(table).findByText("Grace Okafor");
    fireEvent.click(within(table).getAllByRole("button", { name: /actions/i })[0] as HTMLElement);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete relationship" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Grace Okafor loses viewer on document:readme/)).toBeTruthy();
    expect(writes()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete relationship" }));
    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/tenants/t-1/relation-tuples/tu-1"]));
    expect(sensitiveCalls[0]?.actionLabel).toBe("Delete this relationship");
  });
});

describe("ReBAC › add a relationship", () => {
  it("adds a group's members through the step-up, without a confirmation", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add relationship" }));
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(within(drawer).getByRole("button", { name: "A group or object" }));
    fireEvent.change(within(drawer).getByLabelText(/^Subject/), {
      target: { value: "group:engineering#member" },
    });
    fireEvent.click(within(drawer).getByRole("button", { name: "Add relationship" }));

    await waitFor(() => expect(writes()).toEqual(["POST /v1/tenants/t-1/relation-tuples"]));
    const post = vi.mocked(api).mock.calls.find(([, o]) => o?.method === "POST");
    expect(post?.[1]?.body).toEqual({
      object: "document:readme",
      relation: "viewer",
      subject: "group:engineering#member",
    });
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Add this relationship");
    expect(sensitiveCalls.at(-1)?.confirm).toBeUndefined();
  });
});
