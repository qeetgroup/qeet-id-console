import { createFileRoute, redirect } from "@tanstack/react-router";

// The Builder became ABAC's New policy: an old link, a bookmark or a template opens it there (a
// template hands its policy over through the store, which survives the redirect).
export const Route = createFileRoute("/_app/authorization/builder")({
  staticData: { capability: "policy.read" },
  beforeLoad: () => {
    throw redirect({ to: "/authorization/abac", search: { policy: "new" }, replace: true });
  },
});
