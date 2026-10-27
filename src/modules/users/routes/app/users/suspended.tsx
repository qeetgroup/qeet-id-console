import { createFileRoute, redirect } from "@tanstack/react-router";

// Suspended is a filter on All users, not a page of its own: an old link or bookmark lands there.
export const Route = createFileRoute("/_app/users/suspended")({
  staticData: { capability: "user.read" },
  beforeLoad: () => {
    throw redirect({ to: "/users", search: { status: "suspended" }, replace: true });
  },
});
