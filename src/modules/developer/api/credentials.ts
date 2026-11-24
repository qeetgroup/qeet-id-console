// Qeet issues ES256-signed W3C JWT verifiable credentials; relying parties verify them at
// /v1/credentials/verify.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useOrganizationId } from "@/platform/auth/session";
import { developerKeys } from "./keys";
import { backend } from "@/platform/api/backend";

export interface Credential {
  id: string;
  subject: string;
  type: string;
  issued_at: string;
  expires_at?: string | null;
  revoked: boolean;
}

const issueResultSchema = z.object({
  credential_id: z.string(),
  jwt: z.string().min(1), // The signed credential, shown this once
  expires_at: z.string().optional(),
});
export type IssueResult = z.infer<typeof issueResultSchema>;

export interface VerifyResult {
  valid: boolean;
  reason?: string; // English, never shown
  reason_code?: string; // vc.not_credential, vc.signature_invalid, vc.unknown or vc.revoked
  subject?: string;
  issuer?: string;
  vc?: Record<string, unknown>;
}

export function useCredentials() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: developerKeys.credentials(organizationId),
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/credentials", {
        path: { organizationID: organizationId ?? "" },
      }),
    enabled: !!organizationId,
  });
}

export function useIssueCredential() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    mutationFn: (body: {
      subject: string;
      type: string;
      claims: Record<string, unknown>;
      ttl_seconds: number;
    }) =>
      backend.post("/v1/organizations/{organizationID}/credentials", {
        path: { organizationID: organizationId ?? "" },
        body,
        schema: issueResultSchema,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.credentials(organizationId) }),
    meta: { successMessage: "developer:toast.credentialIssued", silentError: true },
  });
}

export function useRevokeCredential() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      backend.post("/v1/organizations/{organizationID}/credentials/{id}/revoke", {
        path: { organizationID: organizationId ?? "", id },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.credentials(organizationId) }),
    meta: { successMessage: "developer:toast.credentialRevoked" },
  });
}

export function useVerifyCredential() {
  return useMutation({
    mutationFn: (credential: string) =>
      backend.post("/v1/credentials/verify", { body: { credential } }),
    meta: { silent: true },
  });
}
