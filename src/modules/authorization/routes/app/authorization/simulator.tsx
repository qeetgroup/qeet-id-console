import { createFileRoute, redirect } from "@tanstack/react-router";

// The Simulator is part of Testing now; an old link or bookmark lands there.
export const Route = createFileRoute("/_app/authorization/simulator")({
  staticData: { capability: "role.read" },
  beforeLoad: () => {
    throw redirect({ to: "/authorization/testing", replace: true });
  },
});
