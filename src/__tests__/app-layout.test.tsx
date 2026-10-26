// @vitest-environment jsdom
// The signed-in console's layout route (src/routes/_app.tsx): who it lets in, and when it hands
// the session to the browser.
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicSession } from "@/platform/auth/server-session";

const state = vi.hoisted(() => ({
  session: null as unknown as PublicSession,
  firstEffectSessionId: undefined as string | null | undefined,
}));

vi.mock("@/platform/api/server-proxy", () => ({ getServerSession: async () => state.session }));
vi.mock("@/platform/auth/email-verification", () => ({ hasVerifiedEmail: async () => true }));
vi.mock("@/platform/auth/session", () => ({ useIdleLogout: vi.fn() }));
const { passthrough } = vi.hoisted(() => ({
  passthrough: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/modules/dashboard", () => ({ ConsoleFrame: passthrough }));
vi.mock("@/platform/security/access-boundary", () => ({ AccessBoundary: passthrough }));
vi.mock("@/platform/security/capability-provider", () => ({ CapabilityProvider: passthrough }));
vi.mock("@/platform/security/sensitive-action-provider", () => ({
  SensitiveActionProvider: passthrough,
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const { useEffect } = await import("react");
  const { sessionStore } = await import("@/platform/auth/session-store");
  // The page, whose effects send its first requests.
  function Page() {
    useEffect(() => {
      state.firstEffectSessionId ??= sessionStore.getSessionId();
    }, []);
    return null;
  }
  return {
    ...(await importOriginal<typeof import("@tanstack/react-router")>()),
    createFileRoute: () => (options: object) => ({
      options,
      useRouteContext: () => ({ session: state.session }),
    }),
    Outlet: Page,
  };
});

import { Route } from "@/routes/_app";

type Options = {
  beforeLoad: (ctx: {
    context: { queryClient: unknown };
    location: { pathname: string; search: Record<string, unknown> };
  }) => Promise<unknown>;
  component: () => React.JSX.Element;
};
const options = Route.options as unknown as Options;
const enter = (pathname: string) =>
  options.beforeLoad({ context: { queryClient: {} }, location: { pathname, search: {} } });

function session(tenantId: string | null): PublicSession {
  return {
    isAuthenticated: true,
    expiresAt: "2030-01-01T00:00:00Z",
    sessionId: "session-1",
    userId: "user-1",
    tenantId,
    version: 1,
    impersonationActor: null,
  } as PublicSession;
}

beforeEach(() => {
  state.session = session("tenant-1");
  state.firstEffectSessionId = undefined;
});
afterEach(cleanup);

describe("the console layout", () => {
  it("keeps My account open to someone without an organisation", async () => {
    state.session = session(null);
    await expect(enter("/account/profile")).resolves.toEqual({ session: state.session });
    await expect(enter("/account")).resolves.toEqual({ session: state.session });
  });

  it("sends someone without an organisation to choose one for every other page", async () => {
    state.session = session(null);
    await expect(enter("/users")).rejects.toMatchObject({
      options: { to: "/select-organization" },
    });
    await expect(enter("/accounts")).rejects.toMatchObject({
      options: { to: "/select-organization" },
    });
  });

  it("hydrates the session before the page sends its first requests", () => {
    // Later, the scope would move under those requests and the client would drop their answers.
    render(<options.component />);
    expect(state.firstEffectSessionId).toBe("session-1");
  });
});
