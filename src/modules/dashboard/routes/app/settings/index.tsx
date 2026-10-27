import { createFileRoute, redirect } from "@tanstack/react-router";

// The Dashboard is the console's one overview; this area opens on General, and an old link or
// bookmark to its overview lands there.
export const Route = createFileRoute("/_app/settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/organization/general", replace: true });
  },
});
