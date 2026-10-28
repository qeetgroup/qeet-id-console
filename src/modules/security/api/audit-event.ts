// One audit event in full, and the last day's pulse. The audit list leaves metadata out, so the
// event drawer reads the event through the Activity API, which serves the same audit rows: the
// event with its details, the events sharing its request, and the actor's within five minutes
// (GET /v1/activity/{id}/related, audit.read). The pulse is GET /v1/activity/summary: the last 24
// hours of the same events, counted.

import { useQuery } from "@tanstack/react-query";

import type { ActivitySummary, RelatedEventsResponse } from "@/modules/activity";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

export function useAuditEvent(id: string | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.auditEvent(tenantId, id ?? ""),
    queryFn: () => api<RelatedEventsResponse>(`/v1/activity/${id}/related`),
    enabled: !!tenantId && !!id,
    staleTime: 60_000,
    meta: { silent: true },
  });
}

export function useAuditPulse() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.auditPulse(tenantId),
    queryFn: () => api<ActivitySummary>("/v1/activity/summary"),
    enabled: !!tenantId,
    staleTime: 60_000,
    meta: { silent: true },
  });
}
