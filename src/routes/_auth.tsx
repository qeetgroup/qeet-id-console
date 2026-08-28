import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AuthBackground } from "@/modules/authentication/components/auth-background";
import { getServerSession } from "@/platform/api/server-proxy";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const session = await getServerSession();
    if (session.isAuthenticated) throw redirect({ to: "/" });
    return { session };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="relative isolate grid min-h-svh place-items-center overflow-hidden bg-zinc-950 p-6 md:p-10">
      <AuthBackground />
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6 md:max-w-4xl">
        <div className="flex items-center justify-center gap-2 self-center font-heading text-lg font-semibold tracking-tight"></div>
        <Outlet />
      </div>
    </div>
  );
}
