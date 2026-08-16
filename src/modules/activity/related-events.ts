// TanStack Query hook for the drawer's "Related events" tab
// (GET /v1/activity/{id}/related). Correlates an anchor event with others that
// share its request_id, and with the same actor in a time window. Disabled until
// an event is selected. 404 (unknown/foreign id, or not deployed) resolves to an
// empty set so the tab degrades gracefully.

import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";

import type { RelatedEventsResponse } from "./activity.types";

const EMPTY: RelatedEventsResponse["related"] = { by_request_id: [], by_actor: [] };

/**
 * Loads events correlated with `eventId`. Returns an empty `related` set (never
 * throws) when the endpoint is unavailable or the id is unknown.
 */
export function useRelatedEvents(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ["activity-related", eventId] as const,
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
