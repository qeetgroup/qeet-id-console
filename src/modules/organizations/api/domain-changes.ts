// Settings › Domains' changes: adding, checking and removing an email domain, and the sign-in
// address (saved in branding). Only that page uses them, so they stay out of the barrel's files.
// Adding and removing a domain need a recent second step; checking it doesn't.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { type Branding, brandingKeys, saveBranding } from "@/modules/branding";
import { backend } from "@/platform/api/backend";
import { useOrganizationId } from "@/platform/auth/session";

import { orgKeys } from "./keys";

export function useAddDomain() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) =>
      backend.post("/v1/organizations/{organizationID}/domains", {
        path: { organizationID: organizationId ?? "" },
        body: { domain },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.domains(organizationId) }),
    meta: { successMessage: "organizations:toast.domainAdded", silentError: true },
  });
}

/** Looks up the domain's TXT record now. A record not found yet is an error the page shows. */
export function useVerifyDomain() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.post("/v1/organizations/{organizationID}/domains/{id}/verify", {
        path: { organizationID: organizationId ?? "", id },
      }),
    // A failed check is stamped on the domain too, so refresh either way.
    onSettled: () => qc.invalidateQueries({ queryKey: orgKeys.domains(organizationId) }),
    meta: { successMessage: "organizations:toast.domainVerified", silentError: true },
  });
}

export function useRemoveDomain() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.delete("/v1/organizations/{organizationID}/domains/{id}", {
        path: { organizationID: organizationId ?? "", id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.domains(organizationId) }),
    meta: { successMessage: "organizations:toast.domainRemoved", silentError: true },
  });
}

/**
 * Saves the sign-in address (`custom_domain`, null to go back to Qeet ID's own). It lives in
 * branding, whose PUT replaces the whole record, so it's merged onto what was read.
 */
export function useSaveSignInAddress() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ branding, host }: { branding: Branding; host: string | null }) => {
      if (!organizationId) throw new Error("No organisation");
      return saveBranding(organizationId, { ...branding, custom_domain: host });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: brandingKeys.organization(organizationId) });
      await qc.invalidateQueries({ queryKey: orgKeys.loginDomain(organizationId) });
    },
    meta: { successMessage: "organizations:toast.signInAddressSaved", silentError: true },
  });
}
