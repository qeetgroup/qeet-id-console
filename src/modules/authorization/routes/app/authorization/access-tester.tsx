import { createFileRoute, redirect } from "@tanstack/react-router";

// The Access tester is Testing's Permission question now; an old link lands there.
export const Route = createFileRoute("/_app/authorization/access-tester")({
  staticData: { capability: "role.read" },
  beforeLoad: () => {
    throw redirect({ to: "/authorization/testing", search: { mode: "permission" }, replace: true });
  },
});
