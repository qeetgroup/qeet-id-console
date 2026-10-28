import { createFileRoute } from "@tanstack/react-router";

import { LdapConnectionPage } from "@/modules/authentication/pages";

// One LDAP connection's page, under Directories › Connections (its row opens it).
export const Route = createFileRoute("/_app/directory/connections/ldap/$id")({
  staticData: { capability: "connection.read" },
  component: function LdapConnectionRoute() {
    return <LdapConnectionPage id={Route.useParams().id} />;
  },
});
