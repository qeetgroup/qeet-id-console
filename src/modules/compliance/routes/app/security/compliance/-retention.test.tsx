// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
vi.mock("@/platform/components/page-header", () => ({
  PageHeader: ({ actions }: { actions?: ReactNode }) => actions ?? null,
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// Records what each sensitive action asked for, then runs it through the real provider.
const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);
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
import { Route } from "./retention";

const Page = Route.options.component as () => React.JSX.Element;

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (path === "/v1/tenants/t-1/retention" && method === "GET") {
      return { deleted_users_enabled: false, deleted_users_days: 30 };
    }
    if (path === "/v1/tenants/t-1/retention" && method === "PUT") return options?.body;
    if (path === "/v1/tenants/t-1/retention/run" && method === "POST") return { purged: 2 };
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
        <Page />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

function changes() {
  return vi
    .mocked(api)
    .mock.calls.map(([path, options]) => `${options?.method ?? "GET"} ${path}`)
    .filter((r) => !r.startsWith("GET "));
}

async function findDialog(): Promise<HTMLElement> {
  const dialog = (await screen.findAllByRole("button", { name: "Cancel" }))
    .map((b) => b.closest('[role="alertdialog"], [role="dialog"]'))
    .find(Boolean);
  if (!dialog) throw new Error("Confirmation dialog is missing");
  return dialog as HTMLElement;
}

async function openPurgeConfirmation(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole("button", { name: "Run purge now" }));
  return findDialog();
}

describe("Compliance › Retention", () => {
  it("confirms before purging soft-deleted users", async () => {
    renderPage();
    const dialog = await openPurgeConfirmation();

    expect(within(dialog).getByText("Permanently purge soft-deleted users?")).toBeTruthy();
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Purge soft-deleted users");
    expect(changes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Run purge now" }));
    await waitFor(() => expect(changes()).toEqual(["POST /v1/tenants/t-1/retention/run"]));
    expect(await screen.findByText("Purged 2 users.")).toBeTruthy();
  });

  it("purges nothing when the confirmation is cancelled", async () => {
    renderPage();
    const dialog = await openPurgeConfirmation();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull());
    expect(changes()).toEqual([]);
  });

  it("saves the policy as a sensitive action, without a confirmation", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Save policy" }));

    await waitFor(() => expect(changes()).toEqual(["PUT /v1/tenants/t-1/retention"]));
    expect(sensitiveCalls[0]?.actionLabel).toBe("Change the retention policy");
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});
