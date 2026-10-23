// Qeet issues ES256-signed W3C JWT verifiable credentials; relying parties verify them at
// /v1/credentials/verify.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { developerKeys } from "./keys";

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
  reason?: string;
  subject?: string;
  issuer?: string;
  vc?: Record<string, unknown>;
}

export function useCredentials() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: developerKeys.credentials(tenantId),
    queryFn: () => api<{ items: Credential[] }>(`/v1/tenants/${tenantId}/credentials`),
    enabled: !!tenantId,
  });
}

export function useIssueCredential() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0, // the response holds a secret shown once; drop it once nothing shows it
    mutationFn: (body: {
      subject: string;
      type: string;
      claims: Record<string, unknown>;
      ttl_seconds: number;
    }) =>
      api(`/v1/tenants/${tenantId}/credentials`, {
        method: "POST",
        body,
        schema: issueResultSchema,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.credentials(tenantId) }),
    meta: { successMessage: "Credential issued", silentError: true },
  });
}

export function useRevokeCredential() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/v1/tenants/${tenantId}/credentials/${id}/revoke`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: developerKeys.credentials(tenantId) }),
    meta: { successMessage: "Credential revoked" },
  });
}

export function useVerifyCredential() {
  return useMutation({
    mutationFn: (credential: string) =>
      api<VerifyResult>(`/v1/credentials/verify`, {
        method: "POST",
        body: { credential },
      }),
    meta: { silent: true },
  });
}
