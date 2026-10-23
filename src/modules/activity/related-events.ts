import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";

import type { RelatedEventsResponse } from "./types/activity.types";
import { useTenantId } from "@/platform/auth/session";
import { activityKeys } from "./api/keys";

const EMPTY: RelatedEventsResponse["related"] = { by_request_id: [], by_actor: [] };

/**
 * Loads events related to `eventId`: those sharing its request_id, and the same actor's around
 * the same time. A 404 (unknown or foreign id), 503 or network error resolves to empty lists.
 */
export function useRelatedEvents(eventId: string | null | undefined) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: activityKeys.related(tenantId, eventId),
    queryFn: async (): Promise<RelatedEventsResponse["related"]> => {
      if (!eventId) return EMPTY;
      try {
        const res = await api<RelatedEventsResponse>(`/v1/activity/${eventId}/related`);
        return res.related ?? EMPTY;
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (!status || status === 404 || status === 503) return EMPTY;
        throw err;
      }
    },
    enabled: !!eventId,
    staleTime: 30_000,
    meta: { silent: true },
  });
}
