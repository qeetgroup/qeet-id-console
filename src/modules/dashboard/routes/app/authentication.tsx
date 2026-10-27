import { createFileRoute, redirect } from "@tanstack/react-router";

// The Dashboard is the console's one overview; this area opens on Sign-in methods, and an old link or
// bookmark to its overview lands there.
export const Route = createFileRoute("/_app/authentication")({
  beforeLoad: () => {
    throw redirect({ to: "/auth/login-methods/password", replace: true });
  },
});
