// SCIM 2.0 provisioning: the per-tenant bearer token an IdP (Okta, Entra ID, Google) presents to
// /scim/v2, which the API origin serves.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, getApiBaseUrl } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

export interface ScimConfig {
  token_set: boolean;
  token_prefix?: string;
  created_at: string | null;
  last_used_at: string | null;
  provisioned_count: number;
}

export interface ScimProvisionedUser {
  id: string;
  email: string;
  display_name: string | null;
  status: string;
  external_id: string | null;
  created_at: string;
}

/** The /scim/v2 base an IdP should be pointed at for this deployment. */
export const scimBaseUrl = () => `${getApiBaseUrl()}/scim/v2`;

export function useScimConfig(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["scim", "config", tenantId],
    enabled: !!tenantId && enabled,
    queryFn: () => api<ScimConfig>(`/v1/tenants/${tenantId}/scim`),
  });
}

export function useScimProvisionedUsers() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["scim", "users", tenantId],
    enabled: !!tenantId,
    queryFn: () => api<{ items: ScimProvisionedUser[] }>(`/v1/tenants/${tenantId}/scim/users`),
  });
}

/**
 * Rotates, or first generates, the bearer token. The plaintext token is in the response once:
 * show it immediately, it can't be read again.
 */
export function useRotateScimToken() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ token: string; config: ScimConfig }>(`/v1/tenants/${tenantId}/scim/token`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scim"] }),
    meta: { successMessage: "SCIM bearer token generated" },
  });
}

export function useRevokeScimToken() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/v1/tenants/${tenantId}/scim/token`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scim"] }),
    meta: { successMessage: "SCIM provisioning disabled" },
  });
}
