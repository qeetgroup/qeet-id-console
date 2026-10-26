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
    // A new organisation's checkout started before payments returned to the create-organisation
    // page comes back to the dashboard; that page finishes it. (Billing's own upgrades return to
    // /settings/billing and stay.)
    const search = location.search as Record<string, unknown>;
    if (location.pathname === "/" && (search.checkout || search.razorpay_payment_link_id)) {
      throw redirect({ to: "/create-organization", search: search as never, replace: true });
    }
    if (organizationSelectionBlocksPath(session.organizationSelectionRequired, location.pathname)) {
      throw redirect({ to: "/select-organization", replace: true });
    }
    // Without an organisation there is no console to show: the picker offers the person's
    // invitations, or takes them on to create one.
    if (!session.tenantId) throw redirect({ to: "/select-organization", replace: true });
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
