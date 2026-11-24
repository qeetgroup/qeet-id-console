// Qeet ID as a SAML identity provider: the rows are the service providers that consume its
// assertions (the inverse of saml.ts). Each organisation is its own IdP, with its own URLs.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiBaseUrl } from "@/platform/api/client";
import { useOrganizationId } from "@/platform/auth/session";
import { authKeys } from "./keys";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";

export type SamlProvider =
  Answer<"/v1/organizations/{organizationID}/saml-providers">["items"][number];

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
export const idpEntityId = (organizationId: string) =>
  `${getApiBaseUrl()}/saml/idp/${organizationId}`;

/** The organisation's IdP metadata document, which an SP imports to trust it. */
export const idpMetadataUrl = (organizationId: string) => `${idpEntityId(organizationId)}/metadata`;

/** The organisation's SingleSignOnService URL, for an SP configured by hand. */
export const idpSsoUrl = (organizationId: string) => `${idpEntityId(organizationId)}/sso`;

/** A sign-in to one app that starts at Qeet ID (IdP-initiated): the app's id names it. */
export const idpSignInUrl = (organizationId: string, appId: string) =>
  `${idpSsoUrl(organizationId)}?sp=${encodeURIComponent(appId)}`;

export function useSamlProviders(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: authKeys.samlProviders(organizationId),
    enabled: enabled && !!organizationId,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/saml-providers", {
        path: { organizationID: organizationId ?? "" },
      }),
  });
}

export function useCreateSamlProvider() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSamlProviderInput) =>
      backend.post("/v1/organizations/{organizationID}/saml-providers", {
        path: { organizationID: organizationId ?? "" },
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.samlProviders(organizationId) }),
    meta: { successMessage: "saml:toast.appAdded", silentError: true }, // the drawer shows it
  });
}

/** `inline`: the caller shows a failure itself (a drawer), so it isn't toasted. */
export function useUpdateSamlProvider({ inline = false }: { inline?: boolean } = {}) {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CreateSamlProviderInput> & { id: string }) =>
      backend.patch("/v1/organizations/{organizationID}/saml-providers/{id}", {
        path: { organizationID: organizationId ?? "", id },
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.samlProviders(organizationId) }),
    meta: { silentError: inline },
  });
}

export function useDeleteSamlProvider() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.delete("/v1/organizations/{organizationID}/saml-providers/{id}", {
        path: { organizationID: organizationId ?? "", id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.samlProviders(organizationId) }),
    meta: { successMessage: "saml:toast.appRemoved" },
  });
}
