import { createFileRoute } from "@tanstack/react-router";

import { LdapPage } from "@/modules/authentication/pages";

// The LDAP connections' page sits under Connections (it was a Directories tab at
// /auth/connections/ldap, which redirects here). The page itself is rebuilt in its own batch.
export const Route = createFileRoute("/_app/directory/connections/ldap")({
  staticData: { capability: "connection.read" },
  component: LdapPage,
});
