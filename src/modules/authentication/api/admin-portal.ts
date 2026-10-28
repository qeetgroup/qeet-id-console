// Self-serve Admin Portal links: a time-limited token, scoped to SAML or SCIM, that lets an
// external IT admin with no Qeet ID account configure this tenant's SSO. The raw token and URL are
// returned once, on generate.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authKeys } from "./keys";

export type AdminPortalCapability = "saml" | "scim";

export interface AdminPortalLink {
  id: string;
  tenant_id: string;
  capabilities: AdminPortalCapability[];
  created_by: string | null;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface GenerateAdminPortalLinkInput {
  capabilities: AdminPortalCapability[];
  ttl_seconds?: number;
}

export interface GenerateAdminPortalLinkResponse {
  link: AdminPortalLink;
  token: string;
  url: string;
}

export function useAdminPortalLinks() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: authKeys.adminPortalLinks(tenantId),
    enabled: !!tenantId,
    queryFn: () => api<{ items: AdminPortalLink[] }>(`/v1/tenants/${tenantId}/admin-portal/links`),
  });
}

export function useGenerateAdminPortalLink() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0, // the link is a bearer credential, shown once
    mutationFn: (body: GenerateAdminPortalLinkInput) =>
      api<GenerateAdminPortalLinkResponse>(`/v1/tenants/${tenantId}/admin-portal/links`, {
        method: "POST",
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.adminPortalLinks(tenantId) }),
    meta: { successMessage: "connections:toast.linkMade", silentError: true }, // the card shows it
  });
}

export function useRevokeAdminPortalLink() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/tenants/${tenantId}/admin-portal/links/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.adminPortalLinks(tenantId) }),
    meta: { successMessage: "connections:toast.linkRevoked" },
  });
}

export function isAdminPortalLinkActive(l: AdminPortalLink): boolean {
  return !l.revoked_at && new Date(l.expires_at).getTime() > Date.now();
}
