// Tenant social-provider configuration (Authentication → Social). The provider catalogue (logos,
// discovery URLs) is presentation and lives in components/social-provider-catalogue.tsx.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, getApiBaseUrl } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authKeys } from "./keys";

export interface SocialProvider {
  tenant_id: string;
  provider: string;
  client_id: string;
  discovery_url: string;
  enabled: boolean;
  updated_at: string;
}

/**
 * Returns the redirect URI the upstream IdP must allowlist. The backend owns the callback leg of
 * the ceremony, so it derives from the API origin rather than the console's.
 */
export const socialRedirectUri = (provider: string) =>
  `${getApiBaseUrl()}/v1/social/${provider}/callback`;

/** Returns the providers configured for the current tenant. */
export function useSocialProviders(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authKeys.socialProviders(tenantId),
    enabled: enabled && !!tenantId,
    queryFn: () => api<{ items: SocialProvider[] }>(`/v1/tenants/${tenantId}/social/providers`),
  });
}

/**
 * The fields an upsert sets. The server rejects unknown fields with a 400 and scopes the row to
 * the caller's tenant, ignoring the tenant_id the hook also sends.
 */
export interface UpsertSocialProviderInput {
  provider: string;
  client_id: string;
  client_secret: string;
  discovery_url: string;
}

/**
 * Creates or replaces one provider's OAuth client credentials. Replacing keeps whether it is
 * switched on, and an empty client_secret keeps the stored one.
 */
export function useUpsertSocialProvider() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertSocialProviderInput) =>
      api<SocialProvider>("/v1/social/providers", {
        method: "POST",
        body: { tenant_id: tenantId, ...input },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.socialProviders(tenantId) }),
    meta: { successMessage: "auth:toast.socialProviderSaved", silentError: true }, // the sheet shows it
  });
}

/** A partial update to a provider: switch it on or off, or replace its credentials. */
export interface UpdateSocialProviderInput {
  enabled?: boolean;
  client_id?: string;
  client_secret?: string; // Replaces the stored secret; omitted or empty keeps it
  discovery_url?: string;
}

export function useUpdateSocialProvider() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, ...input }: UpdateSocialProviderInput & { provider: string }) =>
      api<SocialProvider>(`/v1/social/providers/${encodeURIComponent(provider)}`, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.socialProviders(tenantId) }),
    meta: { successMessage: "auth:toast.socialProviderUpdated", silentError: true }, // the sheet shows it
  });
}

/**
 * Removes a provider, keeping the identities linked through it. The server refuses
 * (social.provider_in_use) while someone can sign in only through it.
 */
export function useDeleteSocialProvider() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) =>
      api<void>(`/v1/social/providers/${encodeURIComponent(provider)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.socialProviders(tenantId) }),
    meta: { successMessage: "auth:toast.socialProviderRemoved", silentError: true }, // the sheet shows it
  });
}
