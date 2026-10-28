// Settings › Domains' changes: adding, checking and removing an email domain, and the sign-in
// address (saved in branding). Only that page uses them, so they stay out of the barrel's files.
// Adding and removing a domain need a recent second step; checking it doesn't.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { type Branding, brandingKeys, saveBranding } from "@/modules/branding";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import type { TenantDomain } from "./domains";
import { orgKeys } from "./keys";

export function useAddDomain() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) =>
      api<TenantDomain>(`/v1/tenants/${tenantId}/domains`, { method: "POST", body: { domain } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.domains(tenantId) }),
    meta: { successMessage: "organizations:toast.domainAdded", silentError: true },
  });
}

/** Looks up the domain's TXT record now. A record not found yet is an error the page shows. */
export function useVerifyDomain() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<TenantDomain>(`/v1/tenants/${tenantId}/domains/${id}/verify`, { method: "POST" }),
    // A failed check is stamped on the domain too, so refresh either way.
    onSettled: () => qc.invalidateQueries({ queryKey: orgKeys.domains(tenantId) }),
    meta: { successMessage: "organizations:toast.domainVerified", silentError: true },
  });
}

export function useRemoveDomain() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/tenants/${tenantId}/domains/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.domains(tenantId) }),
    meta: { successMessage: "organizations:toast.domainRemoved", silentError: true },
  });
}

/**
 * Saves the sign-in address (`custom_domain`, null to go back to Qeet ID's own). It lives in
 * branding, whose PUT replaces the whole record, so it's merged onto what was read.
 */
export function useSaveSignInAddress() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ branding, host }: { branding: Branding; host: string | null }) => {
      if (!tenantId) throw new Error("No organisation");
      return saveBranding(tenantId, { ...branding, custom_domain: host });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: brandingKeys.tenant(tenantId) });
      await qc.invalidateQueries({ queryKey: orgKeys.loginDomain(tenantId) });
    },
    meta: { successMessage: "organizations:toast.signInAddressSaved", silentError: true },
  });
}
