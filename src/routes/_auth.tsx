import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";

import { AuthShell } from "@/modules/authentication/components/auth-shell";
import { getServerSession } from "@/platform/api/server-proxy";

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
  const intent =
    pathname === "/sign-up" ? "signup" : pathname === "/sign-in" ? "signin" : undefined;

  return (
    <AuthShell intent={intent}>
      <Outlet />
    </AuthShell>
  );
}
