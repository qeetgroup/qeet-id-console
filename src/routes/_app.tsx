import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

import { ConsoleFrame } from "@/modules/dashboard";
import { getServerSession } from "@/platform/api/server-proxy";
import { hasVerifiedEmail } from "@/platform/auth/email-verification";
import { organizationSelectionBlocksPath } from "@/platform/auth/organization-selection";
import { useIdleLogout } from "@/platform/auth/session";
import { sessionStore } from "@/platform/auth/session-store";
import { AccessBoundary } from "@/platform/security/access-boundary";
import { CapabilityProvider } from "@/platform/security/capability-provider";
import { SensitiveActionProvider } from "@/platform/security/sensitive-action-provider";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const session = await getServerSession();
    if (!session.isAuthenticated) throw redirect({ to: "/sign-in" });
    // Guarding here, not in the sign-up flow, holds an unverified account on /verify-email across
    // a refresh, a deep link and the back button.
    if (!(await hasVerifiedEmail(context.queryClient, session.userId))) {
      throw redirect({ to: "/verify-email" });
    }
    if (organizationSelectionBlocksPath(session.organizationSelectionRequired, location.pathname)) {
      throw redirect({ to: "/select-organization", replace: true });
    }
    return { session };
  },
  component: AppLayout,
});

function AppLayout() {
  const { session } = Route.useRouteContext();
  useIdleLogout(IDLE_TIMEOUT_MS);

  useEffect(() => {
    sessionStore.hydrate(session);
  }, [session]);

  return (
    <CapabilityProvider>
      <SensitiveActionProvider>
        <ConsoleFrame>
          <AccessBoundary>
            <Outlet />
          </AccessBoundary>
        </ConsoleFrame>
      </SensitiveActionProvider>
    </CapabilityProvider>
  );
}
