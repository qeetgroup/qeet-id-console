import { createFileRoute, redirect } from "@tanstack/react-router";

// The Dashboard is the console's one overview; this area opens on the Applications list, and an old link or
// bookmark to its overview lands there.
export const Route = createFileRoute("/_app/applications")({
  beforeLoad: () => {
    throw redirect({ to: "/auth/connections/oidc", replace: true });
  },
});
