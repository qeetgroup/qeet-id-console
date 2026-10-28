// What the Retention page reads and changes beyond the policy: who the saved window makes due now,
// saving the policy, and removing the due people at once. Page-only, so the shell doesn't carry it.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { userKeys } from "@/modules/users";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { complianceKeys } from "./keys";
import type { RetentionPolicy } from "./retention";

/**
 * How many deleted people the saved window makes due now. The server's preview is a POST that only
 * counts (policy.read), so it's read like any query.
 */
export function useRetentionDue(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: complianceKeys.retentionDue(tenantId),
    enabled: !!tenantId && enabled,
    queryFn: () =>
      api<{ ripe_deleted_users: number; deleted_users_days: number }>(
        `/v1/tenants/${tenantId}/retention/preview`,
        { method: "POST" },
      ),
    meta: { silent: true },
  });
}

export function useUpdateRetentionPolicy() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RetentionPolicy) => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<RetentionPolicy>(`/v1/tenants/${tenantId}/retention`, {
        method: "PUT",
        body,
      });
    },
    onSuccess: (data) => {
      qc.setQueryData(complianceKeys.retention(tenantId), data);
      void qc.invalidateQueries({ queryKey: complianceKeys.retentionDue(tenantId) });
    },
    meta: { successMessage: "compliance:toast.retentionPolicySaved" },
  });
}

/** Removes, now, every deleted person past the saved window, whether automatic removal is on or not. */
export function useRunRetention() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<{ purged: number }>(`/v1/tenants/${tenantId}/retention/run`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: userKeys.deleted(tenantId) });
      void qc.invalidateQueries({ queryKey: complianceKeys.retentionDue(tenantId) });
    },
    meta: { successMessage: "compliance:toast.retentionPurgeComplete" },
  });
}
