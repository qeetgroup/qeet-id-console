// GDPR erasure requests: each purges one person after a grace period, during which it can be
// cancelled.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { complianceKeys } from "./keys";

export interface PurgeRequest {
  id: string;
  tenant_id: string;
  user_id: string;
  requested_by?: string | null;
  reason?: string | null;
  status: "pending" | "completed" | "cancelled";
  grace_until: string;
  completed_at?: string | null;
  created_at: string;
}

export function useGdprPurges() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: complianceKeys.gdprPurges(tenantId),
    queryFn: () => api<{ items: PurgeRequest[] }>(`/v1/tenants/${tenantId}/gdpr/purge`),
    enabled: !!tenantId,
  });
}

export function useCreateGdprPurge() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { user_id: string; reason: string }) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<PurgeRequest>("/v1/gdpr/purge", {
        method: "POST",
        body: { tenant_id: tenantId, ...body },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: complianceKeys.gdprPurges(tenantId) }),
    meta: { successMessage: "Erasure request submitted", silentError: true }, // the sheet shows it
  });
}

export function useCancelGdprPurge() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/gdpr/purge/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: complianceKeys.gdprPurges(tenantId) }),
    meta: { successMessage: "Erasure request cancelled" },
  });
}
