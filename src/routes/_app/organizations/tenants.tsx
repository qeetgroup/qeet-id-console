import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Compatibility redirect. This list lived at `/organizations/tenants` until the
 * console standardised its user-facing vocabulary on "organization" — "tenant"
 * is now internal to the data model and the API (`tenant_id`, `POST /v1/tenants`)
 * and never shown to an operator.
 *
 * Kept so existing bookmarks, shared links and browser history don't 404.
 */
export const Route = createFileRoute("/_app/organizations/tenants")({
  beforeLoad: () => {
    throw redirect({ to: "/organizations", replace: true });
  },
});
