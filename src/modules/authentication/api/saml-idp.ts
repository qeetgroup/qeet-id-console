// Qeet ID as a SAML identity provider: the rows are the service providers that consume its
// assertions (the inverse of saml.ts). Each organisation is its own IdP, with its own URLs.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, getApiBaseUrl } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authKeys } from "./keys";

export interface SamlProvider {
  id: string;
  tenant_id: string;
  name: string;
  entity_id: string;
  acs_url: string;
  name_id_format: string;
  name_id_attribute: string;
  certificate: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface CreateSamlProviderInput {
  name: string;
  entity_id: string;
  acs_url: string;
  name_id_format?: string;
  name_id_attribute?: string;
  certificate?: string;
  status?: "draft" | "active" | "disabled";
}

/** The organisation's IdP entity ID, which its metadata and assertions carry. */
export const idpEntityId = (tenantId: string) => `${getApiBaseUrl()}/saml/idp/${tenantId}`;

/** The organisation's IdP metadata document, which an SP imports to trust it. */
export const idpMetadataUrl = (tenantId: string) => `${idpEntityId(tenantId)}/metadata`;

/** The organisation's SingleSignOnService URL, for an SP configured by hand. */
export const idpSsoUrl = (tenantId: string) => `${idpEntityId(tenantId)}/sso`;

/** A sign-in to one app that starts at Qeet ID (IdP-initiated): the app's id names it. */
export const idpSignInUrl = (tenantId: string, appId: string) =>
  `${idpSsoUrl(tenantId)}?sp=${encodeURIComponent(appId)}`;

export function useSamlProviders(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authKeys.samlProviders(tenantId),
    enabled: enabled && !!tenantId,
    queryFn: () => api<{ items: SamlProvider[] }>(`/v1/tenants/${tenantId}/saml-providers`),
  });
}

export function useCreateSamlProvider() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSamlProviderInput) =>
      api<SamlProvider>(`/v1/tenants/${tenantId}/saml-providers`, {
        method: "POST",
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.samlProviders(tenantId) }),
    meta: { successMessage: "saml:toast.appAdded", silentError: true }, // the drawer shows it
  });
}

/** `inline`: the caller shows a failure itself (a drawer), so it isn't toasted. */
export function useUpdateSamlProvider({ inline = false }: { inline?: boolean } = {}) {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CreateSamlProviderInput> & { id: string }) =>
      api<SamlProvider>(`/v1/tenants/${tenantId}/saml-providers/${id}`, {
        method: "PATCH",
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.samlProviders(tenantId) }),
    meta: { silentError: inline },
  });
}

export function useDeleteSamlProvider() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/tenants/${tenantId}/saml-providers/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.samlProviders(tenantId) }),
    meta: { successMessage: "saml:toast.appRemoved" },
  });
}
