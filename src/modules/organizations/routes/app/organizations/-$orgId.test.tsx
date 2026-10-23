// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const navigate = vi.hoisted(() => vi.fn());
const sensitiveCalls = vi.hoisted(
  () => [] as { actionLabel?: string; capability?: string; confirm?: unknown }[],
);

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/auth/session")>()),
  useTenantId: () => "org-current",
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
// The route hands the page its param, search and tab navigation; the page navigates on delete.
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: object) => ({
    options,
    useParams: () => ({ orgId: "org-2" }),
    useSearch: () => ({ tab: "overview" }),
    useNavigate: () => navigate,
  }),
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import type { Org } from "@/modules/organizations/api/orgs";
import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./$orgId";

const OrgDetailPage = Route.options.component as () => React.JSX.Element;

let org: Org;

beforeEach(() => {
  org = {
    id: "org-2",
    slug: "acme",
    name: "Acme",
    status: "active",
    plan: "pro",
    region: "in",
    logo_url: "",
    created_at: "2026-09-01T00:00:00Z",
    member_count: 4,
  };
  sensitiveCalls.length = 0;
  navigate.mockReset();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants" && method === "GET") return { items: [org] };
    if (path === "/v1/tenants/org-2" && method !== "GET") return undefined;
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
        <OrgDetailPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

async function chooseAction(name: string) {
  fireEvent.click(await screen.findByRole("button", { name: /actions/i }));
  fireEvent.click(await screen.findByRole("menuitem", { name }));
}

function writes() {
  return vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => ({ path, method: options?.method, body: options?.body }));
}

describe("Organization detail › sensitive actions", () => {
  it("suspends only after the destructive confirmation", async () => {
    renderPage();
    await chooseAction("Suspend");

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Suspend this organization?")).toBeTruthy();
    expect(writes()).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend" }));

    await waitFor(() =>
      expect(writes()).toEqual([
        { path: "/v1/tenants/org-2", method: "PATCH", body: { status: "suspended" } },
      ]),
    );
    expect(sensitiveCalls[0]).toMatchObject({
      capability: "tenant.write",
      actionLabel: "Suspend this organization",
    });
  });

  it("leaves the organization alone when the suspension is cancelled", async () => {
    renderPage();
    await chooseAction("Suspend");

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });

  it("reactivates through the sensitive path without a confirmation", async () => {
    org.status = "suspended";
    renderPage();
    await chooseAction("Reactivate");

    await waitFor(() =>
      expect(writes()).toEqual([
        { path: "/v1/tenants/org-2", method: "PATCH", body: { status: "active" } },
      ]),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(sensitiveCalls[0]).toMatchObject({
      capability: "tenant.write",
      actionLabel: "Reactivate this organization",
    });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("deletes after confirmation and returns to the list", async () => {
    renderPage();
    await chooseAction("Delete organization");

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Delete this organization?")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/organizations" }));
    expect(writes()).toEqual([{ path: "/v1/tenants/org-2", method: "DELETE", body: undefined }]);
    expect(sensitiveCalls[0]).toMatchObject({
      capability: "tenant.write",
      actionLabel: "Delete organization",
    });
  });

  it("stays on the page when the delete is cancelled", async () => {
    renderPage();
    await chooseAction("Delete organization");

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
  });
});
