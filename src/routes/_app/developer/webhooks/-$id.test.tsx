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

let current: Record<string, unknown> = webhook;

beforeEach(() => {
  sensitive.calls = [];
  current = webhook;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/webhooks/wh-1" && !options?.method) return current;
    if (path === "/v1/tenants/tenant-1/webhooks/wh-1/rotate-secret" && options?.method === "POST") {
      return { secret: "whsec_rotated", previous_secret_expires_at: "2030-01-02T10:00:00Z" };
    }
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

describe("Webhook detail — rotating its secret", () => {
  it("rotates after confirming, and shows the new secret once with when the old one stops", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /rotate secret/i }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Rotate" }));

    expect(await screen.findByText("whsec_rotated")).toBeTruthy();
    expect(screen.getByText(/the previous secret stops signing/)).toBeTruthy();
    expect(sensitive.calls[0]?.actionLabel).toBe("rotate this webhook's signing secret");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("whsec_rotated")).toBeNull();
  });
});

describe("Webhook detail — its state", () => {
  it("explains an endpoint its failures disabled, and offers to enable it", async () => {
    current = {
      ...webhook,
      disabled_at: "2026-10-21T08:00:00Z",
      disabled_reason: "failing",
      failing_since: "2026-10-18T08:00:00Z",
    };
    renderPage();

    expect(
      await screen.findByText(/Disabled automatically because its deliveries kept failing/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /enable/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^disable$/i })).toBeNull();
  });

  it("says while a rotated-out secret still signs", async () => {
    current = { ...webhook, previous_secret_expires_at: "2099-01-01T00:00:00Z" };
    renderPage();

    expect(await screen.findByText(/previous signing secret still signs deliveries/)).toBeTruthy();
  });

  it("shows the payload the server actually sends", async () => {
    renderPage();
    await screen.findByText(/Sample payload/);
    const sample = document.body.textContent ?? "";
    expect(sample).toContain('"type": "user.created"');
    expect(sample).toContain('"occurred_at"');
    expect(sample).not.toContain('"event":');
  });
});
