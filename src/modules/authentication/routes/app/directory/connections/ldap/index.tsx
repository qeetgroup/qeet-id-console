import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { LdapIndexPage } from "@/modules/authentication/pages";
import { searchEnum } from "@/shared/utils/search-params";

// Where "LDAP or Active Directory" leads (it was a Directories tab at /auth/connections/ldap, which
// redirects here): the one connection's page, the list for several, or how to connect one.
// `?action=create` opens the New connection drawer.
export const Route = createFileRoute("/_app/directory/connections/ldap/")({
  staticData: { capability: "connection.read", pageHeader: true },
  validateSearch: z.object({ action: searchEnum(["create"]) }),
  component: LdapIndexRoute,
});

function LdapIndexRoute() {
  const { action } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <LdapIndexPage
      creating={action === "create"}
      onCreatingChange={(open) =>
        navigate({ search: () => (open ? { action: "create" as const } : {}), replace: true })
      }
    />
  );
}
