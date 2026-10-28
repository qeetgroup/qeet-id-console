// GDPR erasure requests: each erases one person's personal data once its grace period ends; until
// then it can be withdrawn. Filing needs a step-up; the server keeps the 200 newest.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { complianceKeys } from "./keys";

/** `quarantined`: the sweeper found the account no longer belongs here, so it erased nothing. */
export type PurgeStatus = "pending" | "completed" | "cancelled" | "quarantined";

export interface PurgeRequest {
  id: string;
  tenant_id: string;
  user_id: string;
  requested_by?: string | null;
  reason?: string | null;
  status: PurgeStatus;
  grace_until: string;
  completed_at?: string | null;
  created_at: string;
}

/** How long a request waits (gdpr.NewService in the server's bootstrap; not configurable). */
export const ERASURE_GRACE_DAYS = 30;

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
    meta: { successMessage: "compliance:toast.erasureRequestSubmitted", silentError: true }, // the drawer shows it
  });
}

export function useCancelGdprPurge() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/gdpr/purge/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: complianceKeys.gdprPurges(tenantId) }),
    meta: { successMessage: "compliance:toast.erasureRequestCancelled" },
  });
}
