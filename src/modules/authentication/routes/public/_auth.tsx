import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";

import { AuthShell } from "@/modules/authentication/pages";
import { getServerSession } from "@/platform/api/server-proxy";

// Pages already on @qeetrix/react: each renders its own EntryShell, so the layout adds no frame.
const ENTRY_PAGES = new Set(["/sign-in", "/sign-up", "/forgot-password", "/magic"]);

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const session = await getServerSession();
    if (session.isAuthenticated)
      throw redirect({ to: session.organizationSelectionRequired ? "/select-organization" : "/" });
    return { session };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (ENTRY_PAGES.has(pathname)) return <Outlet />;

  // The pages still on @qeetrix/ui (invitations, the SSO return) keep their frame.
  return (
    <AuthShell>
      <Outlet />
    </AuthShell>
  );
}
