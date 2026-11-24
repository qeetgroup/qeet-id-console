// Tenant social-provider configuration (Authentication › Social). The provider catalogue (logos,
// discovery URLs) is presentation and lives in components/methods/social-catalogue.tsx.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiBaseUrl } from "@/platform/api/client";
import { useOrganizationId } from "@/platform/auth/session";
import { authKeys } from "./keys";
import { backend } from "@/platform/api/backend";
import type { Schemas } from "@/platform/api/contract";

/** One of the organisation's providers, as the server returns it: never its secret. */
export type SocialProvider = Schemas<"federation">["Provider"];

/**
 * Returns the redirect URI the upstream IdP must allowlist. The backend owns the callback leg of
 * the ceremony, so it derives from the API origin rather than the console's.
 */
export const socialRedirectUri = (provider: string) =>
  `${getApiBaseUrl()}/v1/social/${provider}/callback`;

/** Returns the providers configured for the current tenant. */
export function useSocialProviders(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: authKeys.socialProviders(organizationId),
    enabled: enabled && !!organizationId,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/social/providers", {
        path: { organizationID: organizationId ?? "" },
      }),
  });
}

/**
 * The fields an upsert sets. The server rejects unknown fields with a 400 and scopes the row to
 * the caller's organization.
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
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertSocialProviderInput) =>
      backend.post("/v1/social/providers", { body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.socialProviders(organizationId) }),
    meta: { successMessage: "authentication:toast.socialProviderSaved", silentError: true }, // the sheet shows it
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
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, ...input }: UpdateSocialProviderInput & { provider: string }) =>
      backend.patch("/v1/social/providers/{provider}", { path: { provider }, body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.socialProviders(organizationId) }),
    meta: { successMessage: "authentication:toast.socialProviderUpdated", silentError: true }, // the sheet shows it
  });
}

/**
 * Removes a provider, keeping the identities linked through it. The server refuses
 * (social.provider_in_use) while someone can sign in only through it.
 */
export function useDeleteSocialProvider() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) =>
      backend.delete("/v1/social/providers/{provider}", { path: { provider } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.socialProviders(organizationId) }),
    meta: { successMessage: "authentication:toast.socialProviderRemoved", silentError: true }, // the sheet shows it
  });
}
