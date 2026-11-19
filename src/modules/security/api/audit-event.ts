// One audit event in full, and the last day's pulse. The audit list leaves metadata out, so the
// event drawer reads the event through the Activity API, which serves the same audit rows: the
// event with its details, the events sharing its request, and the actor's within five minutes
// (GET /v1/activity/{id}/related, audit.read). The pulse is GET /v1/activity/summary: the last 24
// hours of the same events, counted.

import { useQuery } from "@tanstack/react-query";

import { useOrganizationId } from "@/platform/auth/session";
import { securityKeys } from "./keys";
import { backend } from "@/platform/api/backend";

export function useAuditEvent(id: string | undefined) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.auditEvent(organizationId, id ?? ""),
    queryFn: () => backend.get("/v1/activity/{id}/related", { path: { id: id ?? "" } }),
    enabled: !!organizationId && !!id,
    staleTime: 60_000,
    meta: { silent: true },
  });
}

export function useAuditPulse() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.auditPulse(organizationId),
    queryFn: () => backend.get("/v1/activity/summary"),
    enabled: !!organizationId,
    staleTime: 60_000,
    meta: { silent: true },
  });
}
