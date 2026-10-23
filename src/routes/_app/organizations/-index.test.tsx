// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const sensitiveCalls = vi.hoisted(
  () => [] as { actionLabel?: string; capability?: string; confirm?: unknown }[],
);

vi.mock("@/platform/api/client", () => ({
  api: vi.fn(),
  sessionStore: { getTenantId: () => "org-current" },
}));
vi.mock("@/platform/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/platform/auth/session")>()),
  useTenantId: () => "org-current",
}));
vi.mock("@/platform/components/page-header", () => ({ PageHeader: () => null }));
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
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import type { Org } from "@/modules/organizations/api/orgs";
import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./index";

const TenantsPage = Route.options.component as () => React.JSX.Element;

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
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants" && method === "GET") return { items: [org] };
    if (path === "/v1/tenants/org-2" && method !== "GET") return org;
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
        <TenantsPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

async function chooseRowAction(name: string) {
  await screen.findByText("Acme");
  const row = screen.getByText("Acme").closest("tr") as HTMLElement;
  fireEvent.click(within(row).getByRole("button", { name: "Actions" }));
  fireEvent.click(await screen.findByRole("menuitem", { name }));
}

function writes() {
  return vi
    .mocked(api)
    .mock.calls.filter(([, options]) => (options?.method ?? "GET") !== "GET")
    .map(([path, options]) => ({ path, method: options?.method, body: options?.body }));
}

describe("Organizations › row actions", () => {
  it("suspends only after the destructive confirmation", async () => {
    renderPage();
    await chooseRowAction("Suspend");

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
      actionLabel: "suspend this organization",
    });
  });

  it("reactivates through the sensitive path without a confirmation", async () => {
    org.status = "suspended";
    renderPage();
    await chooseRowAction("Reactivate");

    await waitFor(() =>
      expect(writes()).toEqual([
        { path: "/v1/tenants/org-2", method: "PATCH", body: { status: "active" } },
      ]),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(sensitiveCalls[0]).toMatchObject({ actionLabel: "reactivate this organization" });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("deletes only after the destructive confirmation", async () => {
    renderPage();
    await chooseRowAction("Delete organization");

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Delete this organization?")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(writes()).toEqual([{ path: "/v1/tenants/org-2", method: "DELETE", body: undefined }]),
    );
    expect(sensitiveCalls[0]).toMatchObject({
      capability: "tenant.write",
      actionLabel: "delete organization",
    });
  });

  it("deletes nothing when the confirmation is cancelled", async () => {
    renderPage();
    await chooseRowAction("Delete organization");

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(writes()).toEqual([]);
  });

  it("saves the edit sheet through the sensitive path, the submit being the confirmation", async () => {
    renderPage();
    await chooseRowAction("Edit organization");

    const name = await screen.findByLabelText(/^Name/);
    fireEvent.change(name, { target: { value: "Acme Labs" } });
    fireEvent.submit(name.closest("form") as HTMLFormElement);

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({
      path: "/v1/tenants/org-2",
      method: "PATCH",
      body: { name: "Acme Labs", status: "active", region: "in" },
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(sensitiveCalls[0]).toMatchObject({
      capability: "tenant.write",
      actionLabel: "edit this organization",
    });
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});
