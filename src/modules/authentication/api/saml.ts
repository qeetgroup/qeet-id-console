// SAML connections to a tenant's identity providers. The SP metadata and login URLs an IdP needs
// are served at the API origin, so they derive from the API base URL.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, getApiBaseUrl } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authKeys } from "./keys";

export type SamlStatus = "draft" | "active" | "disabled";

export interface SamlConnection {
  id: string;
  tenant_id: string;
  name: string;
  idp_entity_id: string;
  idp_sso_url: string;
  idp_certificate: string;
  email_attribute: string;
  name_attribute: string;
  status: SamlStatus;
  /** Whether a sign-in the identity provider starts (no request from Qeet ID) is accepted. */
  allow_idp_initiated?: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

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
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authKeys.saml(tenantId),
    enabled: enabled && !!tenantId,
    queryFn: () => api<{ items: SamlConnection[] }>(`/v1/tenants/${tenantId}/saml`),
  });
}

export function useCreateSamlConnection() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSamlInput) =>
      api<SamlConnection>(`/v1/tenants/${tenantId}/saml`, {
        method: "POST",
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.saml(tenantId) }),
    meta: { successMessage: "saml:toast.signInCreated", silentError: true }, // the drawer shows it
  });
}

/** `inline`: the caller shows a failure itself (a drawer), so it isn't toasted. */
export function useUpdateSamlConnection({ inline = false }: { inline?: boolean } = {}) {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: Partial<CreateSamlInput> & { id: string; allow_idp_initiated?: boolean }) =>
      api<SamlConnection>(`/v1/tenants/${tenantId}/saml/${id}`, {
        method: "PATCH",
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.saml(tenantId) }),
    meta: { silentError: inline },
  });
}

export function useDeleteSamlConnection() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/tenants/${tenantId}/saml/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.saml(tenantId) }),
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
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: (id: string) =>
      api<SamlTestResult>(`/v1/tenants/${tenantId}/saml/${id}/test`, {
        method: "POST",
      }),
    meta: { silent: true },
  });
}
