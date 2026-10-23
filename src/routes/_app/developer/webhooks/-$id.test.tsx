// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import type { SensitiveActionOptions } from "@/platform/security/sensitive-action-provider";

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("@/platform/components/page-header", () => ({
  PageHeader: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({ state: "ready", can: () => true }),
}));
// Records each sensitive action's options while the real provider confirms and runs it.
const sensitive = vi.hoisted(() => ({ calls: [] as SensitiveActionOptions<unknown>[] }));
vi.mock("@/platform/security/sensitive-action-provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/platform/security/sensitive-action-provider")>();
  return {
    ...actual,
    useSensitiveAction: () => {
      const run = actual.useSensitiveAction();
      return <T,>(options: SensitiveActionOptions<T>) => {
        sensitive.calls.push(options);
        return run(options);
      };
    },
  };
});
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useParams: () => ({ id: "wh-1" }),
  }),
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
}));

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./$id";

const WebhookDetailPage = Route.options.component as () => React.JSX.Element;

const webhook = {
  id: "wh-1",
  tenant_id: "tenant-1",
  url: "https://example.com/hooks/qeet",
  events: ["user.created"],
  disabled_at: null,
  created_at: "2026-09-24T10:15:00Z",
};

beforeEach(() => {
  sensitive.calls = [];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/webhooks/wh-1" && !options?.method) return webhook;
    if (path === "/v1/webhooks/wh-1/deliveries") return { items: [] };
    if (path === "/v1/webhooks/wh-1" && options?.method === "DELETE") return undefined;
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
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
        <WebhookDetailPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

describe("Webhook detail — disabling it", () => {
  it("disables only after the admin confirms", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /disable/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain(`Disable ${webhook.url}?`);
    expect(api).not.toHaveBeenCalledWith(
      "/v1/webhooks/wh-1",
      expect.objectContaining({ method: "DELETE" }),
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Disable" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/v1/webhooks/wh-1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("disable this webhook");
  });
});
