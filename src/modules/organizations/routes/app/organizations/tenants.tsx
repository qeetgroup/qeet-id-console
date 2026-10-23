import { createFileRoute, redirect } from "@tanstack/react-router";

// Redirects to /organizations so bookmarks and shared links to this path don't 404; operators
// only ever see "organization", while "tenant" stays internal to the data model and API.
export const Route = createFileRoute("/_app/organizations/tenants")({
  beforeLoad: () => {
    throw redirect({ to: "/organizations", replace: true });
  },
});
