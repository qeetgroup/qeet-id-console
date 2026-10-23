// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

const sensitiveCalls = vi.hoisted(() => [] as { actionLabel?: string; confirm?: unknown }[]);

vi.mock("@/platform/api/client", () => ({ api: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "t-1" }));
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

import { api } from "@/platform/api/client";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./general";

const GeneralPage = Route.options.component as () => React.JSX.Element;

const tenant = {
  id: "t-1",
  slug: "acme",
  name: "Acme",
  status: "active",
  plan: "pro",
  region: "in",
  logo_url: "",
  metadata: {},
  created_at: "2026-09-01T00:00:00Z",
};

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/tenants/t-1") return tenant;
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
});
afterEach(cleanup);

describe("Organization settings › General", () => {
  it("saves the organization details through the sensitive path, the submit being the confirmation", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <SensitiveActionProvider>
          <GeneralPage />
        </SensitiveActionProvider>
      </QueryClientProvider>,
    );

    const name = (await screen.findByLabelText(/^Organization name/)) as HTMLInputElement;
    await waitFor(() => expect(name.value).toBe("Acme"));
    fireEvent.change(name, { target: { value: "Acme Labs" } });
    fireEvent.submit(name.closest("form") as HTMLFormElement);

    await waitFor(() =>
      expect(vi.mocked(api).mock.calls.some(([, o]) => o?.method === "PATCH")).toBe(true),
    );
    const patch = vi.mocked(api).mock.calls.find(([, o]) => o?.method === "PATCH");
    expect(patch?.[1]?.body).toMatchObject({ name: "Acme Labs", region: "in", status: "active" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(sensitiveCalls).toHaveLength(1);
    expect(sensitiveCalls[0]?.actionLabel).toBe("save your organization details");
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});
