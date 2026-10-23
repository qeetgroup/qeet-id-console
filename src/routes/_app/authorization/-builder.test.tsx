// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("@/platform/components/page-header", () => ({
  PageHeader: ({ actions }: { actions?: React.ReactNode }) => <div>{actions}</div>,
}));
// The canvas and preview need a real browser; the save under test doesn't use them.
vi.mock("@/modules/authorization/components/canvas/policy-canvas", () => ({
  PolicyCanvas: () => null,
}));
vi.mock("@/modules/authorization/components/code-preview/code-preview", () => ({
  CodePreview: () => null,
}));

import { api } from "@/platform/api/client";
import { setBuilderDoc } from "@/modules/authorization/store/authz-store";
import { emptyPolicyDoc } from "@/modules/authorization/utils/policy-codegen";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";
import { Route } from "./builder";

const BuilderPage = Route.options.component as () => React.JSX.Element;

beforeEach(() => {
  sensitiveCalls.length = 0;
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path === "/v1/tenants/t-1/abac/policies" && options?.method === "POST") return {};
    throw new Error(`Unexpected request ${options?.method ?? "GET"} ${path}`);
  });
  // A template hand-off, so the doc arrives named and ready to save.
  setBuilderDoc({ ...emptyPolicyDoc(), name: "allow_eng" });
});
afterEach(cleanup);

describe("Policy builder › save as ABAC", () => {
  it("creates the policy through the step-up path without a confirmation", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <SensitiveActionProvider>
          <BuilderPage />
        </SensitiveActionProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /save as abac/i }));

    await waitFor(() =>
      expect(vi.mocked(api)).toHaveBeenCalledWith(
        "/v1/tenants/t-1/abac/policies",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(sensitiveCalls).toEqual([
      expect.objectContaining({ actionLabel: "create this policy" }),
    ]);
    expect(sensitiveCalls[0]?.confirm).toBeUndefined();
  });
});
