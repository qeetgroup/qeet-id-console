import { createFileRoute } from "@tanstack/react-router";

import { LdapPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/connections/ldap")({
  component: LdapPage,
});
