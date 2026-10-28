import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useOAuthGrants } from "@/modules/authentication/api/oauth-grants";
import { useOidcClients } from "@/modules/authentication/api/oidc-clients";
import { userQueries } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { joinGrants } from "./grants-model";

/**
 * Grants, and which application or person each is, joined from what this person can read. People's
 * names come from the Users directory, read only when `withPeople` (Tokens shows none).
 */
export function useGrantRows({ withPeople = true }: { withPeople?: boolean } = {}) {
  const access = useCapabilities();
  const tenantId = useTenantId();
  const grants = useOAuthGrants();
  const clients = useOidcClients();
  // Names need user.read; without it, people are their email.
  const people = useQuery({
    ...userQueries.directory(tenantId),
    enabled: withPeople && !!tenantId && access.can("user.read"),
  });
  const rows = useMemo(
    () => joinGrants(grants.data?.items ?? [], people.data?.items, clients.data?.items),
    [grants.data, people.data, clients.data],
  );
  return { grants, rows, clients: clients.data?.items };
}
