// SCIM 2.0 provisioning, read: the per-tenant bearer token an IdP (Okta, Entra ID, Google)
// presents to /scim/v2, which the API origin serves. Making and revoking it is scim-actions.ts.

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api, getApiBaseUrl } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authKeys } from "./keys";

export const scimConfigSchema = z.object({
  token_set: z.boolean(),
  token_prefix: z.string().optional(),
  created_at: z.string().nullable(),
  last_used_at: z.string().nullable(),
  provisioned_count: z.number().int().nonnegative(),
});
export type ScimConfig = z.infer<typeof scimConfigSchema>;

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
