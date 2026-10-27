import { createFileRoute, redirect } from "@tanstack/react-router";

// The Dashboard is the console's one overview; this area opens on Threats, and an old link or
// bookmark to its overview lands there.
export const Route = createFileRoute("/_app/security/")({
  beforeLoad: () => {
    throw redirect({ to: "/security/threats/bots", replace: true });
  },
});
