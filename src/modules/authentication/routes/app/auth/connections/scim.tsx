import { createFileRoute, redirect } from "@tanstack/react-router";

// The page moved under Directory › Directories › Connections; old links and bookmarks land there.
export const Route = createFileRoute("/_app/auth/connections/scim")({
  beforeLoad: () => {
    throw redirect({ to: "/directory/connections/scim", replace: true });
  },
});
