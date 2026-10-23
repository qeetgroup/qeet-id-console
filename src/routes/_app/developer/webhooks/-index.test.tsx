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
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/modules/billing", () => ({
  useEntitlements: () => ({ data: { features: { webhooks: true } } }),
  FeatureGate: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
vi.mock("@/shared/hooks/use-create-intent", async (importOriginal) => {
  const { useState } = await import("react");
  return {
    ...(await importOriginal<typeof import("@/shared/hooks/use-create-intent")>()),
    useCreateIntent: () => useState(false),
  };
});

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./index";

const WebhooksPage = Route.options.component as () => React.JSX.Element;

const webhook = {
  id: "wh-1",
  tenant_id: "tenant-1",
  url: "https://example.com/hooks/qeet",
  events: ["user.created"],
  disabled_at: null,
  created_at: "2026-09-24T10:15:00Z",
};

const failing = {
  ...webhook,
  id: "wh-3",
  url: "https://example.com/hooks/flaky",
  failing_since: "2026-10-20T08:00:00Z",
};
const autoDisabled = {
  ...webhook,
  id: "wh-4",
  url: "https://example.com/hooks/dead",
  disabled_at: "2026-10-21T08:00:00Z",
  disabled_reason: "failing",
  failing_since: "2026-10-18T08:00:00Z",
};
const catalogue = {
  items: [
    { name: "user.created", description: "server English" },
    { name: "user.deleted", description: "server English" },
    { name: "widget.frobnicated", description: "an event this console doesn't know" },
  ],
};

let listed: unknown[] = [webhook];

beforeEach(() => {
  sensitive.calls = [];
  listed = [webhook];
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/tenants/tenant-1/webhooks") return { items: listed };
    if (path === "/v1/tenants/tenant-1/webhooks/events") return catalogue;
    if (path === "/v1/webhooks" && options?.method === "POST") {
      return { ...webhook, id: "wh-2", url: "https://example.com/new", secret: "whsec_once" };
    }
    if (path === "/v1/webhooks/wh-1" && options?.method === "DELETE") return undefined;
    if (path === "/v1/tenants/tenant-1/webhooks/wh-4/enable" && options?.method === "POST") {
      return { ...autoDisabled, disabled_at: null, disabled_reason: null, failing_since: null };
    }
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
        <WebhooksPage />
      </SensitiveActionProvider>
    </QueryClientProvider>,
  );
}

describe("Webhooks — creating one", () => {
  it("creates through the sensitive-action path and shows the signing secret once", async () => {
    renderPage();
    await screen.findByText(webhook.url);

    fireEvent.click(screen.getByRole("button", { name: /new webhook/i }));
    fireEvent.change(await screen.findByLabelText(/^URL/), {
      target: { value: "https://example.com/new" },
    });
    fireEvent.click(await screen.findByRole("checkbox", { name: /user\.created/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("whsec_once")).toBeTruthy();
    expect(api).toHaveBeenCalledWith(
      "/v1/webhooks",
      expect.objectContaining({
        method: "POST",
        body: { tenant_id: "tenant-1", url: "https://example.com/new", events: ["user.created"] },
      }),
    );
    expect(screen.getByText("Signing secret for https://example.com/new")).toBeTruthy();
    expect(screen.getByRole("button", { name: /copy/i })).toBeTruthy();
    expect(sensitive.calls[0]?.actionLabel).toBe("create this webhook");
    expect(sensitive.calls[0]?.confirm).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("whsec_once")).toBeNull();
  });
});

describe("Webhooks — the event catalogue", () => {
  it("offers the server's events, worded by the console, never the server's descriptions", async () => {
    renderPage();
    await screen.findByText(webhook.url);
    fireEvent.click(screen.getByRole("button", { name: /new webhook/i }));

    const created = await screen.findByRole("checkbox", { name: /user\.created/ });
    expect(created.closest("label")?.textContent).toContain(
      "A person was added to the organization",
    );
    expect(screen.getByRole("checkbox", { name: /widget\.frobnicated/ })).toBeTruthy();
    expect(screen.queryByText("server English")).toBeNull();
    expect(screen.queryByText("an event this console doesn't know")).toBeNull();
  });

  it("asks for an event before creating", async () => {
    renderPage();
    await screen.findByText(webhook.url);
    fireEvent.click(screen.getByRole("button", { name: /new webhook/i }));
    fireEvent.change(await screen.findByLabelText(/^URL/), {
      target: { value: "https://example.com/new" },
    });
    await screen.findByRole("checkbox", { name: /user\.created/ });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(sensitive.calls).toHaveLength(0));
    expect(api).not.toHaveBeenCalledWith("/v1/webhooks", expect.anything());
  });
});

describe("Webhooks — failing and disabled endpoints", () => {
  it("shows which endpoints are failing or were disabled by their failures", async () => {
    listed = [webhook, failing, autoDisabled];
    renderPage();
    await screen.findByText(failing.url);

    expect(screen.getByText("Failing")).toBeTruthy();
    expect(screen.getByText("Disabled: failing")).toBeTruthy();
  });

  it("enables a disabled endpoint through the sensitive-action path", async () => {
    listed = [autoDisabled];
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /enable/i }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/v1/tenants/tenant-1/webhooks/wh-4/enable",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("enable this webhook");
    expect(sensitive.calls[0]?.confirm).toBeUndefined();
  });
});

describe("Webhooks — disabling one", () => {
  it("disables only after the admin confirms", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /disable/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Disable webhook?");
    expect(api).not.toHaveBeenCalledWith("/v1/webhooks/wh-1", expect.anything());

    fireEvent.click(within(dialog).getByRole("button", { name: "Disable" }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/v1/webhooks/wh-1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    expect(sensitive.calls[0]?.actionLabel).toBe("disable this webhook");
  });

  it("keeps a disabled endpoint listed, so it can be enabled again", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /disable/i }));
    const dialog = await screen.findByRole("alertdialog");
    listed = [{ ...webhook, disabled_at: "2026-10-23T10:00:00Z", disabled_reason: "disabled" }];
    fireEvent.click(within(dialog).getByRole("button", { name: "Disable" }));

    expect(await screen.findByRole("button", { name: /enable/i })).toBeTruthy();
    expect(screen.getByText(webhook.url)).toBeTruthy();
  });
});
