// SAML connections to a tenant's identity providers. The SP metadata and login URLs an IdP needs
// are served at the API origin, so they derive from the API base URL.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiBaseUrl } from "@/platform/api/client";
import { useOrganizationId } from "@/platform/auth/session";
import { authKeys } from "./keys";
import { backend } from "@/platform/api/backend";
import type { Schemas } from "@/platform/api/contract";
import { isOneOf } from "@/shared/utils/one-of";

const SAML_STATUSES = ["draft", "active", "disabled"] as const;
export type SamlStatus = (typeof SAML_STATUSES)[number];

/** A connection's status as the console knows it; the document leaves it a free string. */
export const samlStatus = (status: string): SamlStatus =>
  isOneOf(SAML_STATUSES, status) ? status : "disabled";

export type SamlConnection = Schemas<"federation">["SAMLConnection"];

export interface CreateSamlInput {
  name: string;
  idp_entity_id: string;
  idp_sso_url: string;
  idp_certificate: string;
  email_attribute?: string;
  name_attribute?: string;
  status?: SamlStatus;
}

export const samlMetadataUrl = (id: string) => `${getApiBaseUrl()}/saml/metadata/${id}`;
export const samlLoginUrl = (id: string) => `${getApiBaseUrl()}/saml/login/${id}`;
/** Where the identity provider sends people back after they sign in (the ACS URL). */
export const samlAcsUrl = (id: string) => `${getApiBaseUrl()}/saml/acs/${id}`;

export function useSamlConnections(enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: authKeys.saml(organizationId),
    enabled: enabled && !!organizationId,
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/saml", {
        path: { organizationID: organizationId ?? "" },
      }),
  });
}

export function useCreateSamlConnection() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSamlInput) =>
      backend.post("/v1/organizations/{organizationID}/saml", {
        path: { organizationID: organizationId ?? "" },
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.saml(organizationId) }),
    meta: { successMessage: "saml:toast.signInCreated", silentError: true }, // the drawer shows it
  });
}

/** `inline`: the caller shows a failure itself (a drawer), so it isn't toasted. */
export function useUpdateSamlConnection({ inline = false }: { inline?: boolean } = {}) {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: Partial<CreateSamlInput> & { id: string; allow_idp_initiated?: boolean }) =>
      backend.patch("/v1/organizations/{organizationID}/saml/{id}", {
        path: { organizationID: organizationId ?? "", id },
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.saml(organizationId) }),
    meta: { silentError: inline },
  });
}

export function useDeleteSamlConnection() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.delete("/v1/organizations/{organizationID}/saml/{id}", {
        path: { organizationID: organizationId ?? "", id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.saml(organizationId) }),
    meta: { successMessage: "saml:toast.signInDeleted" },
  });
}

export interface SamlTestCheck {
  name: string;
  ok: boolean;
  detail?: string;
}
export interface SamlTestResult {
  ok: boolean;
  checks: SamlTestCheck[];
}

/** Runs offline checks on a connection's configuration before it is enabled. */
export function useTestSamlConnection() {
  const organizationId = useOrganizationId();
  return useMutation({
    mutationFn: (id: string) =>
      backend.post("/v1/organizations/{organizationID}/saml/{id}/test", {
        path: { organizationID: organizationId ?? "", id },
      }),
    meta: { silent: true },
  });
}
