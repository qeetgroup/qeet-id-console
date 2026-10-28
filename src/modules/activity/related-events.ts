import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";

import type { RelatedEventsResponse } from "./types/activity.types";
import { useTenantId } from "@/platform/auth/session";
import { activityKeys } from "./api/keys";

/**
 * Loads one event by its ID, with the events related to it: those sharing its request ID, and the
 * same person's within five minutes either side (GET /v1/activity/{id}/related, up to 20 each).
 * Any audit event's ID works: Activity and the audit log read the same records. Resolves to null
 * when there's no such event in this organisation (a 404); other errors throw.
 */
export function useRelatedEvents(eventId: string | null | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: activityKeys.related(tenantId, eventId),
    queryFn: async ({ signal }): Promise<RelatedEventsResponse | null> => {
      try {
        const res = await api<RelatedEventsResponse>(
          `/v1/activity/${encodeURIComponent(eventId ?? "")}/related`,
          { signal },
        );
        return {
          event: res.event,
          related: {
            by_request_id: res.related?.by_request_id ?? [],
            by_actor: res.related?.by_actor ?? [],
          },
        };
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404 || status === 400) return null;
        throw err;
      }
    },
    enabled: !!eventId,
    staleTime: 60_000,
    meta: { silent: true },
  });
}
