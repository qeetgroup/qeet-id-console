// @vitest-environment jsdom
// Lives beside the route with a "-" prefix so the router generator ignores it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";

import type { PublicSession } from "@/platform/auth/server-session";

const session: PublicSession = {
  isAuthenticated: true,
  expiresAt: "2030-01-01T00:00:00Z",
  sessionId: "session-1",
  userId: "user-1",
  tenantId: "tenant-1",
  version: 1,
  impersonationActor: null,
};

vi.mock("@/platform/api/client", async () => {
  const { ApiError } = await import("@/platform/errors/api-error");
  return {
    ApiError,
    api: vi.fn(async (path: string) => {
      if (path === "/v1/mfa/totp") return { enrolled: true };
      if (path.endsWith("/permissions")) return { permissions: [] };
      return { items: [] };
    }),
  };
});
vi.mock("@/platform/api/server-proxy", () => ({ getServerSession: vi.fn() }));
vi.mock("@/platform/auth/session", () => ({
  useIdleLogout: vi.fn(),
  useMe: () => ({ data: { email: "ada@example.com" } }),
  useTenantId: () => "tenant-1",
  useUserId: () => "user-1",
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: object) => ({
    options,
    useRouteContext: () => ({ session }),
  }),
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  Outlet: () => null,
  useRouterState: () => "/account/data",
}));

import { ApiError } from "@/platform/errors/api-error";
import { requestStepUp } from "@/platform/security/step-up-gate";
import { Route } from "./account";

const AccountLayout = Route.options.component as () => React.JSX.Element;

afterEach(cleanup);

describe("account layout", () => {
  it("answers a step-up refusal with the step-up dialog", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AccountLayout />
      </QueryClientProvider>,
    );

    act(() => {
      void requestStepUp(new ApiError(403, "step_up_required", "needs mfa"));
    });

    await waitFor(() => expect(screen.getByText(/confirm it's you/i)).toBeTruthy());
  });
});
