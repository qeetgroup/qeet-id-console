import { createFileRoute, redirect } from "@tanstack/react-router";

// The Dashboard is the console's one overview; this area opens on Users, and an old link or
// bookmark to its overview lands there.
export const Route = createFileRoute("/_app/directory/")({
  beforeLoad: () => {
    throw redirect({ to: "/users", replace: true });
  },
});
