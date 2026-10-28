import { createFileRoute, redirect } from "@tanstack/react-router";

// The Decision explorer is Testing's list of this tab's decisions now; an old link lands there.
export const Route = createFileRoute("/_app/authorization/explorer")({
  staticData: { capability: "role.read" },
  beforeLoad: () => {
    throw redirect({ to: "/authorization/testing", replace: true });
  },
});
