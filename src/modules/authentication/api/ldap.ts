// LDAP / Active Directory connections, read. bind_password is write-only: accepted on create and
// update (ldap-actions.ts, which only the LDAP pages load), never returned.

import { useQuery } from "@tanstack/react-query";
import { useOrganizationId } from "@/platform/auth/session";
import { authKeys } from "./keys";
import { backend } from "@/platform/api/backend";
import type { Body, Schemas } from "@/platform/api/contract";
import { isOneOf } from "@/shared/utils/one-of";

const LDAP_STATUSES = ["draft", "active", "disabled"] as const;
export type LdapStatus = (typeof LDAP_STATUSES)[number];

/** A connection's status as the console knows it; the document leaves it a free string. */
export const ldapStatus = (status: string): LdapStatus =>
  isOneOf(LDAP_STATUSES, status) ? status : "disabled";

export type LdapConnection = Schemas<"federation">["LdapConnection"];

export type CreateLdapInput = Body<"/v1/organizations/{organizationID}/ldap", "post">;

export function useLdapConnections(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: authKeys.ldap(organizationId),
    enabled: !!organizationId && enabled,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/ldap", {
        path: { organizationID: organizationId ?? "" },
      }),
  });
}
