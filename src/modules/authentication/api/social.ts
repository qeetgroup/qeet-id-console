// Tenant social-provider configuration (Authentication → Social).
//
// Lives here rather than inline in the route because three surfaces now read it —
// the Social page, its configure sheet, and the Authentication overview — and
// `docs/llm/workflows.md` requires data access to sit in a module's api/ dir,
// never in a component.
//
// Note the provider *catalogue* (logos, icon classes, discovery URLs) is
// presentation, not data: it lives in
// `components/social-provider-catalogue.tsx`.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API_BASE_URL, api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

export interface SocialProvider {
  tenant_id: string;
  provider: string;
  client_id: string;
  discovery_url: string;
  enabled: boolean;
  updated_at: string;
}

export const SOCIAL_PROVIDERS_KEY = ["social-providers"] as const;

const apiOrigin = API_BASE_URL.replace(/\/$/, "");

/**
 * The redirect URI the upstream IdP must have on its allowlist. The backend
 * owns the callback leg of the ceremony, so it is derived from the API origin
 * rather than the console's own.
 */
export const socialRedirectUri = (provider: string) =>
  `${apiOrigin}/v1/social/${provider}/callback`;

/** Providers configured for the current tenant. */
export function useSocialProviders(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...SOCIAL_PROVIDERS_KEY, tenantId],
    enabled: enabled && !!tenantId,
    queryFn: () => api<{ items: SocialProvider[] }>(`/v1/tenants/${tenantId}/social/providers`),
  });
}

/**
 * The upsert the backend accepts — exactly these fields. `POST
 * /v1/social/providers` decodes with `DisallowUnknownFields`, and it scopes the
 * row to the caller's tenant itself, so anything extra is a 400.
 */
export interface UpsertSocialProviderInput {
  provider: string;
  client_id: string;
  client_secret: string;
  discovery_url: string;
}

/** Create or replace one provider's OAuth client credentials. */
export function useUpsertSocialProvider() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertSocialProviderInput) =>
      api<SocialProvider>("/v1/social/providers", {
        method: "POST",
        body: { tenant_id: tenantId, ...input },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SOCIAL_PROVIDERS_KEY }),
    meta: { successMessage: "Social provider saved" },
  });
}
