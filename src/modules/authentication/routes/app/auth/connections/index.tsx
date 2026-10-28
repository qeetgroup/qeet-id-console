import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { searchEnum, searchText } from "@/shared/utils/search-params";

// The connections list became SSO's (Authentication › SSO): SAML sign-in and SAML apps. LDAP and
// SCIM live in Directories › Connections. Old links land on SSO, with what still applies of their
// search (a provisioning view has no SSO match) and their #setup-links.
export const Route = createFileRoute("/_app/auth/connections/")({
  validateSearch: z.object({
    q: searchText(),
    type: searchEnum(["signin", "provisioning", "apps"]),
    show: searchEnum(["attention", "setup"]),
  }),
  beforeLoad: ({ search, location }) => {
    throw redirect({
      to: "/auth/connections/saml",
      search: {
        q: search.q,
        type: search.type === "provisioning" ? undefined : search.type,
        show: search.show,
      },
      hash: location.hash || undefined,
      replace: true,
    });
  },
});
