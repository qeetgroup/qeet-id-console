// SCIM 2.0 provisioning: the per-tenant bearer token an IdP (Okta, Entra ID, Google) presents to
// /scim/v2, which the API origin serves.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api, getApiBaseUrl } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authKeys } from "./keys";

const scimConfigSchema = z.object({
  token_set: z.boolean(),
  token_prefix: z.string().optional(),
  created_at: z.string().nullable(),
  last_used_at: z.string().nullable(),
  provisioned_count: z.number().int().nonnegative(),
});
export type ScimConfig = z.infer<typeof scimConfigSchema>;

const scimTokenSchema = z.object({
  token: z.string().min(1), // Shown this once
  config: scimConfigSchema,
});

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
    queryKey: authKeys.scimConfig(tenantId),
    enabled: !!tenantId && enabled,
    queryFn: () => api<ScimConfig>(`/v1/tenants/${tenantId}/scim`),
  });
}

export function useScimProvisionedUsers() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authKeys.scimUsers(tenantId),
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
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    mutationFn: () =>
      api(`/v1/tenants/${tenantId}/scim/token`, { method: "POST", schema: scimTokenSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.scim(tenantId) }),
    meta: { successMessage: "auth:toast.scimBearerTokenGenerated" },
  });
}

export function useRevokeScimToken() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/v1/tenants/${tenantId}/scim/token`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.scim(tenantId) }),
    meta: { successMessage: "auth:toast.scimProvisioningDisabled" },
  });
}
