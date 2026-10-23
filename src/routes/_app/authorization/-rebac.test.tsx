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
vi.mock("@/platform/components/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/modules/authorization/components/graph/relationship-graph", () => ({
  RelationshipGraph: () => null,
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./rebac";

const RebacPage = Route.options.component as () => React.JSX.Element;

const tuple = {
  id: "tu-1",
  tenant_id: "t-1",
  object: "document:readme",
  relation: "viewer",
  subject: "user:u-1",
  created_at: "2026-10-01T00:00:00Z",
};

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path.startsWith("/v1/tenants/t-1/relation-tuples") && method === "GET") {
      return { items: [tuple] };
    }
    if (path === "/v1/tenants/t-1/relation-tuples" && method === "POST") return tuple;
    if (path === "/v1/tenants/t-1/relation-tuples/tu-1" && method === "DELETE") return undefined;
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
        <RebacPage />
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

// The cards share field labels, so each is reached through the form its button submits.
function formOf(button: string): HTMLElement {
  const form = screen.getByRole("button", { name: button }).closest("form");
  if (!form) throw new Error(`no form holds ${button}`);
  return form;
}

async function browse() {
  const form = formOf("Show");
  fireEvent.change(within(form).getByLabelText(/^Object/), {
    target: { value: "document:readme" },
  });
  fireEvent.click(within(form).getByRole("button", { name: "Show" }));
  fireEvent.click(await screen.findByRole("button", { name: /delete/i }));
  return screen.findByRole("alertdialog");
}

describe("ReBAC › write a relationship", () => {
  it("writes through the step-up path without a confirmation", async () => {
    renderPage();
    const form = formOf("Write tuple");
    fireEvent.change(within(form).getByLabelText(/^Object/), {
      target: { value: "document:readme" },
    });
    fireEvent.change(within(form).getByLabelText(/^Relation/), { target: { value: "viewer" } });
    fireEvent.change(within(form).getByLabelText(/^Subject/), { target: { value: "user:u-1" } });
    fireEvent.click(within(form).getByRole("button", { name: "Write tuple" }));

    await waitFor(() => expect(writes()).toEqual(["POST /v1/tenants/t-1/relation-tuples"]));
    expect(sensitiveCalls[0]?.actionLabel).toBe("write this relationship");
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});

describe("ReBAC › delete a relationship", () => {
  it("deletes only after the destructive confirmation names the tuple", async () => {
    renderPage();
    const dialog = await browse();
    expect(within(dialog).getByText("Delete this relationship?")).toBeTruthy();
    expect(within(dialog).getByText(/document:readme#viewer user:u-1/)).toBeTruthy();
    expect(writes()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(writes()).toEqual(["DELETE /v1/tenants/t-1/relation-tuples/tu-1"]));
    expect(sensitiveCalls[0]?.actionLabel).toBe("delete this relationship");
  });

  it("sends nothing when the confirmation is cancelled", async () => {
    renderPage();
    const dialog = await browse();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });
});
