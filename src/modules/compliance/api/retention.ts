// The tenant's opt-in retention policy: how long soft-deleted users are kept before they are
// purged. A background sweeper applies it hourly. The changes are in retention-changes.ts, which
// only the Retention page loads.

import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { complianceKeys } from "./keys";

export interface RetentionPolicy {
  deleted_users_enabled: boolean;
  deleted_users_days: number;
}

/** The days the server accepts for the window (it clamps anything else to them). */
export const RETENTION_DAYS = { min: 1, max: 3650 } as const;

/** The tenant's retention rules; `enabled: false` for someone who can't read them (policy.read). */
export function useRetentionPolicy(enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: complianceKeys.retention(tenantId),
    enabled: !!tenantId && enabled,
    queryFn: () => api<RetentionPolicy>(`/v1/tenants/${tenantId}/retention`),
  });
}
