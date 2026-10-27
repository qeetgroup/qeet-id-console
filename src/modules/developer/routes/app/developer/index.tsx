import { createFileRoute, redirect } from "@tanstack/react-router";

// The Dashboard is the console's one overview; this area opens on API keys, and an old link or
// bookmark to its overview lands there.
export const Route = createFileRoute("/_app/developer/")({
  beforeLoad: () => {
    throw redirect({ to: "/auth/api/keys", replace: true });
  },
});
