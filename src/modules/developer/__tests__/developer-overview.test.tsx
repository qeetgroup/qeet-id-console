// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const context = vi.hoisted(() => ({
  tenantId: "tenant-a" as string | null,
  state: "ready",
  permissions: new Set<string>(),
}));
vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => context.tenantId }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    ...props
  }: ComponentProps<"a"> & {
    to: string;
    search?: Record<string, string>;
  }) => <a {...props} href={search ? `${to}?${new URLSearchParams(search)}` : to} />,
}));
vi.mock("@/platform/security/capability-provider", () => ({
  useCapabilities: () => ({
    state: context.state,
    can: (permission?: string) => !permission || context.permissions.has(permission),
    canAll: (permissions: string[]) =>
      permissions.every((permission) => context.permissions.has(permission)),
  }),
}));

import { api } from "@/platform/api/client";
import { navGroups } from "@/platform/config/navigation";
import { type DeveloperOverviewData, useDeveloperOverview } from "../api/overview";
import { DeveloperOverviewView } from "../components/developer-overview";
import { isCurrentCredential, summarizeDeveloperRecords } from "../overview-model";

const NOW = Date.parse("2026-09-12T12:00:00Z");

beforeEach(() => {
  context.tenantId = "tenant-a";
  context.state = "ready";
  context.permissions = new Set([
    "apikey.read",
    "connection.read",
    "webhook.read",
    "secret.read",
    "audit.read",
  ]);
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(
    async (path) => (path === "/v1/activity" ? { events: [] } : { items: [] }) as never,
  );
});

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
});

function renderOverview(
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return renderHook(() => useDeveloperOverview(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

describe("Developer overview metrics", () => {
  it("counts actual creations in seven UTC calendar days without inventing a growth rate", () => {
    const metric = summarizeDeveloperRecords(
      [
        { created_at: "2026-09-01T12:00:00Z" },
        { created_at: "2026-09-06T00:00:00Z" },
        { created_at: "2026-09-11T23:59:00Z" },
        { issued_at: "2026-09-12T10:00:00Z" },
        { created_at: "2026-09-13T00:00:00Z" },
      ],
      NOW,
    );
    expect(metric.total).toBe(5);
    expect(metric.recent).toBe(3);
    expect(metric.series.map((point) => point.count)).toEqual([1, 0, 0, 0, 0, 1, 1]);
    expect(metric.series[0].date).toBe("2026-09-06");
  });

  it("distinguishes empty lists from missing history", () => {
    expect(summarizeDeveloperRecords([], NOW)).toMatchObject({ total: 0, recent: 0 });
    expect(summarizeDeveloperRecords([{ created_at: null }], NOW)).toEqual({
      total: 1,
      recent: null,
      series: [],
    });
    expect(summarizeDeveloperRecords([{ created_at: "invalid" }], NOW).series).toEqual([]);
  });

  it("excludes expired and revoked credentials, including malformed expiry dates", () => {
    expect(isCurrentCredential({}, NOW)).toBe(true);
    expect(isCurrentCredential({ expires_at: "2026-09-13T00:00:00Z" }, NOW)).toBe(true);
    expect(isCurrentCredential({ expires_at: "2026-09-12T12:00:00Z" }, NOW)).toBe(false);
    expect(isCurrentCredential({ expires_at: "invalid" }, NOW)).toBe(false);
    expect(isCurrentCredential({ revoked_at: "2026-09-11T00:00:00Z" }, NOW)).toBe(false);
  });
});

describe("Developer overview data", () => {
  it("uses existing tenant-scoped metadata endpoints and the developer activity category", async () => {
    const { result } = renderOverview();
    await waitFor(() =>
      expect(result.current.resources.every((resource) => !!resource.data)).toBe(true),
    );
    const paths = vi.mocked(api).mock.calls.map(([path]) => path);
    for (const path of [
      "api-keys",
      "oauth/grants",
      "webhooks",
      "auth-hooks",
      "agents",
      "secrets",
      "credentials",
    ]) {
      expect(paths).toContain(`/v1/tenants/tenant-a/${path}`);
    }
    expect(paths.some((path) => /reveal|rotate|\/token$/.test(path))).toBe(false);
    expect(api).toHaveBeenCalledWith(
      "/v1/activity",
      expect.objectContaining({
        query: { category: "developer", limit: 30 },
      }),
    );
    expect(result.current.areas).toHaveLength(10);
    expect(result.current.canCreateKey).toBe(false);
    expect(result.current.canCreateWebhook).toBe(false);
  });

  it.each(["resolving", "error"])("does not request data while access is %s", (state) => {
    context.state = state;
    const { result } = renderOverview();
    expect(api).not.toHaveBeenCalled();
    expect(result.current.resources.every((resource) => !resource.allowed)).toBe(true);
    expect(result.current.areas).toEqual([]);
  });

  it("does not request data without an organization or expose cached metadata after denial", () => {
    context.tenantId = null;
    renderOverview();
    expect(api).not.toHaveBeenCalled();
    cleanup();
    context.tenantId = "tenant-a";
    context.permissions.clear();
    const client = new QueryClient();
    client.setQueryData(["secrets", "tenant-a"], {
      items: [{ id: "secret", created_at: "2026-09-01" }],
    });
    const { result } = renderOverview(client);
    expect(api).not.toHaveBeenCalled();
    expect(result.current.resources.every((resource) => !resource.data)).toBe(true);
  });

  it("does not complete checklist steps for disabled or revoked configuration", async () => {
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === "/v1/activity") return { events: [] } as never;
      return {
        items: [
          {
            id: "resource",
            created_at: "2026-09-01",
            revoked_at: "2026-09-02",
            revoked: true,
            enabled: false,
            disabled: true,
            disabled_at: "2026-09-02",
            status: "suspended",
          },
        ],
      } as never;
    });
    const { result } = renderOverview();
    await waitFor(() =>
      expect(result.current.resources.every((resource) => !!resource.data)).toBe(true),
    );
    for (const id of ["keys", "webhooks", "hooks", "agents", "credentials"]) {
      expect(
        result.current.resources.find((resource) => resource.id === id)?.data?.configured,
      ).toBe(false);
    }
  });

  it("keeps API failures distinct from an empty configuration", async () => {
    vi.mocked(api).mockRejectedValue(new Error("private backend details"));
    const { result } = renderOverview();
    await waitFor(() =>
      expect(result.current.resources.every((resource) => resource.error)).toBe(true),
    );
    expect(result.current.resources.every((resource) => !resource.data)).toBe(true);
    expect(result.current.activity.data).toBeUndefined();
  });

  it("never exposes raw activity payloads or events for denied resources", async () => {
    context.permissions.delete("secret.read");
    vi.mocked(api).mockImplementation(async (path) => {
      if (path !== "/v1/activity") return { items: [] } as never;
      return {
        events: [
          {
            id: "private",
            type: "secret.created",
            at: "2026-09-12T10:00:00Z",
            description: "secret value",
          },
          {
            id: "public",
            type: "apikey.created",
            at: "2026-09-12T10:00:00Z",
            title: "private title",
            metadata: { token: "private-token" },
          },
        ],
      } as never;
    });
    const { result } = renderOverview();
    await waitFor(() => expect(result.current.activity.data).toHaveLength(1));
    expect(result.current.activity.data?.[0]).toMatchObject({
      id: "public",
      area: "keys",
      verb: "created",
    });
    expect(JSON.stringify(result.current.activity.data)).not.toMatch(
      /private|token|metadata|description/,
    );
  });
});

function viewData(): DeveloperOverviewData {
  const ids = ["keys", "tokens", "webhooks", "hooks", "agents", "secrets", "credentials"] as const;
  const totals = [18, 126, 6, 4, 9, 23, 1];
  return {
    tenantId: "tenant-a",
    accessState: "ready",
    canCreateKey: true,
    canCreateWebhook: true,
    areas:
      navGroups
        .find((group) => group.label === "Developer")
        ?.items.filter((item) => item.url !== "/developer") ?? [],
    resources: ids.map((id, index) => ({
      id,
      allowed: true,
      loading: false,
      error: false,
      busy: false,
      retry: vi.fn(),
      data: {
        total: totals[index],
        recent: 2,
        configured: id === "keys" || id === "webhooks",
        series: [
          { date: "2026-09-11", count: 1 },
          { date: "2026-09-12", count: 1 },
        ],
      },
    })),
    activity: {
      allowed: true,
      loading: false,
      error: false,
      busy: false,
      retry: vi.fn(),
      data: [
        {
          id: "event-1",
          area: "keys",
          verb: "created",
          at: "2026-09-12T10:00:00Z",
          targetId: "key-123456",
        },
      ],
    },
  };
}

describe("Developer overview layout", () => {
  it.each(["light", "dark"])(
    "keeps all content, counts, sections and actions synchronized in %s",
    (theme) => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      const { container } = render(<DeveloperOverviewView data={viewData()} />);
      expect(screen.getByRole("heading", { name: "Overview", level: 1 })).toBeTruthy();
      expect(screen.getAllByRole("article")).toHaveLength(6);
      expect(screen.getByRole("article", { name: "API keys" }).textContent).toContain("18");
      expect(screen.getByRole("article", { name: "Active grants" }).textContent).toContain("126");
      expect(
        within(screen.getByRole("navigation", { name: "Developer areas" })).getAllByRole("link"),
      ).toHaveLength(10);
      expect(screen.getByRole("region", { name: "Recent developer activity" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Quick actions" })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Integration checklist" })).toBeTruthy();
      expect(screen.getByText("2 of 5 complete")).toBeTruthy();
      expect(screen.getByText("API key created")).toBeTruthy();
      for (const element of container.querySelectorAll("[class]")) {
        expect(element.getAttribute("class")).not.toMatch(
          /\bdark:(hidden|block|flex|grid|order-|p[xy]-|m[xy]-)/,
        );
      }
    },
  );

  it("links both create actions to existing forms and uses real documentation destinations", () => {
    render(<DeveloperOverviewView data={viewData()} />);
    const quick = within(screen.getByRole("navigation", { name: "Quick actions" }));
    expect(quick.getByRole("link", { name: /Create API key/ }).getAttribute("href")).toBe(
      "/auth/api/keys?action=create",
    );
    expect(quick.getByRole("link", { name: /Create webhook/ }).getAttribute("href")).toBe(
      "/developer/webhooks?action=create",
    );
    expect(quick.getByRole("link", { name: /View SDKs/ }).getAttribute("href")).toBe(
      "https://docs.id.qeet.in/docs/sdks",
    );
    expect(quick.getByRole("link", { name: /Open the quickstart/ }).getAttribute("href")).toBe(
      "https://docs.id.qeet.in/docs/getting-started/quickstart",
    );
  });

  it("hides creation controls for read-only access without hiding management links", () => {
    const data = viewData();
    data.canCreateKey = false;
    data.canCreateWebhook = false;
    render(<DeveloperOverviewView data={data} />);
    expect(screen.queryByRole("link", { name: "Create API key" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Create webhook/ })).toBeNull();
    expect(
      within(screen.getByRole("navigation", { name: "Developer areas" })).getAllByRole("link"),
    ).toHaveLength(10);
  });

  it("shows safe failures with working retries instead of zero totals", () => {
    const data = viewData();
    const resource = data.resources[0];
    resource.error = true;
    resource.data = undefined;
    data.activity.error = true;
    data.activity.data = undefined;
    render(<DeveloperOverviewView data={data} />);
    expect(screen.getByRole("article", { name: "API keys" }).textContent).toContain("Unavailable");
    expect(screen.getByRole("article", { name: "API keys" }).textContent).not.toContain("18");
    fireEvent.click(screen.getByRole("button", { name: "Retry API keys" }));
    expect(resource.retry).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(data.activity.retry).toHaveBeenCalledOnce();
    expect(screen.getByText("1 of 5 complete")).toBeTruthy();
  });

  it("does not render denied cached counters or activity", () => {
    const data = viewData();
    data.resources[5].allowed = false;
    data.activity.allowed = false;
    render(<DeveloperOverviewView data={data} />);
    const secrets = within(screen.getByRole("article", { name: "Secrets" }));
    expect(secrets.queryByText("23")).toBeNull();
    expect(secrets.getByText("Restricted")).toBeTruthy();
    expect(screen.queryByText("API key created")).toBeNull();
  });

  it("provides organization selection without showing unavailable account totals", () => {
    const data = viewData();
    data.tenantId = null;
    data.canCreateKey = false;
    data.canCreateWebhook = false;
    render(<DeveloperOverviewView data={data} />);
    expect(screen.getByRole("heading", { name: "Choose an organization first" })).toBeTruthy();
    expect(screen.queryByRole("article")).toBeNull();
  });
});
