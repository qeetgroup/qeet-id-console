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
import { Route } from "./log-streaming";

const LogStreamingPage = Route.options.component as () => React.JSX.Element;

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const method = options?.method ?? "GET";
    if (method === "GET" && path === "/v1/tenants/t-1/log-sinks") {
      return {
        items: [
          {
            id: "sink-1",
            tenant_id: "t-1",
            type: "datadog",
            endpoint: "https://logs.example.test/intake",
            enabled: true,
            created_at: "2026-10-20T08:00:00Z",
          },
        ],
      };
    }
    if (path === "/v1/tenants/t-1/log-sinks" && method === "POST") return { id: "sink-2" };
    if (path === "/v1/tenants/t-1/log-sinks/sink-1" && ["PATCH", "DELETE"].includes(method)) {
      return undefined;
    }
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
        <LogStreamingPage />
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

async function openRemoveConfirmation(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
  const cancel = await screen.findByRole("button", { name: "Cancel" });
  const dialog = cancel.closest('[role="alertdialog"], [role="dialog"]');
  if (!dialog) throw new Error("Confirmation dialog is missing");
  return dialog as HTMLElement;
}

describe("Security › Log streaming", () => {
  it("adds a sink as a sensitive action, without a confirmation", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText(/^Endpoint URL/), {
      target: { value: "https://siem.example.test/hec" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(changes()).toEqual(["POST /v1/tenants/t-1/log-sinks"]));
    expect(sensitiveCalls).toHaveLength(1);
    expect(sensitiveCalls[0]?.actionLabel).toBe("Add a log sink");
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("pauses a sink as a sensitive action", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("switch", { name: "Enabled" }));

    await waitFor(() => expect(changes()).toEqual(["PATCH /v1/tenants/t-1/log-sinks/sink-1"]));
    expect(sensitiveCalls[0]?.actionLabel).toBe("Pause or resume a log sink");
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });

  it("confirms before removing a sink", async () => {
    renderPage();
    const dialog = await openRemoveConfirmation();

    expect(within(dialog).getByText("Remove this sink?")).toBeTruthy();
    expect(sensitiveCalls.at(-1)?.actionLabel).toBe("Remove this log sink");
    expect(changes()).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(changes()).toEqual(["DELETE /v1/tenants/t-1/log-sinks/sink-1"]));
  });

  it("keeps the sink when the removal is cancelled", async () => {
    renderPage();
    const dialog = await openRemoveConfirmation();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull());
    expect(changes()).toEqual([]);
  });
});
