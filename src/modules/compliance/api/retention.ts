// The tenant's opt-in retention policy: how long soft-deleted users are kept before they are
// purged. A background sweeper applies it; preview and run let an admin check or trigger it.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { userKeys } from "@/modules/users";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { complianceKeys } from "./keys";

export interface RetentionPolicy {
  deleted_users_enabled: boolean;
  deleted_users_days: number;
}

export function useRetentionPolicy() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: complianceKeys.retention(tenantId),
    enabled: !!tenantId,
    queryFn: () => api<RetentionPolicy>(`/v1/tenants/${tenantId}/retention`),
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
    onSuccess: (data) => qc.setQueryData(complianceKeys.retention(tenantId), data),
    meta: { successMessage: "Retention policy saved", silentError: true }, // the form shows it
  });
}

export function useRetentionPreview() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: () => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<{ ripe_deleted_users: number; deleted_users_days: number }>(
        `/v1/tenants/${tenantId}/retention/preview`,
        { method: "POST" },
      );
    },
    meta: { silent: true },
  });
}

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
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.deleted(tenantId) }),
    meta: { successMessage: "Retention purge complete" },
  });
}
