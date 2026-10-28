// LDAP / Active Directory connections, read. bind_password is write-only: accepted on create and
// update (ldap-actions.ts, which only the LDAP pages load), never returned.

import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authKeys } from "./keys";

export type LdapStatus = "draft" | "active" | "disabled";

export interface LdapConnection {
  id: string;
  tenant_id: string;
  name: string;
  server_url: string;
  start_tls: boolean;
  skip_tls_verify: boolean;
  bind_dn: string;
  base_dn: string;
  user_filter: string;
  email_attribute: string;
  name_attribute: string;
  status: LdapStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface CreateLdapInput {
  name: string;
  server_url: string;
  start_tls?: boolean;
  skip_tls_verify?: boolean;
  bind_dn: string;
  bind_password: string;
  base_dn: string;
  user_filter?: string;
  email_attribute?: string;
  name_attribute?: string;
  status?: LdapStatus;
}

export function useLdapConnections(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authKeys.ldap(tenantId),
    enabled: !!tenantId && enabled,
    queryFn: () => api<{ items: LdapConnection[] }>(`/v1/tenants/${tenantId}/ldap`),
  });
}
