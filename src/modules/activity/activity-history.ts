import { useInfiniteQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";

import type { ActivityEvent, ActivityFilters } from "./types/activity.types";

export type ActivityHistoryPage = {
  events: ActivityEvent[];
  next_cursor?: string;
};

const HISTORY_LIMIT = 50;

/** Returns the /v1/activity query for filters and a cursor; exports reuse it to match the view. */
export function buildActivityQuery(
  filters: ActivityFilters,
  cursor: string,
  limit = HISTORY_LIMIT,
): Record<string, string | number | undefined> {
  return {
    limit,
    cursor: cursor || undefined,
    types: filters.types.join(",") || undefined,
    severity: filters.severity.join(",") || undefined,
    category: filters.category.join(",") || undefined,
    actor: filters.actor || undefined,
    q: filters.q || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    source: filters.source || undefined,
    status: filters.status || undefined,
    ip: filters.ip || undefined,
  };
}

/**
 * Fetches one page of GET /v1/activity. A 404, 503 or network error yields an empty page so
 * the view degrades gracefully while the endpoint is unavailable; other errors throw.
 */
export async function fetchActivityPage(
  filters: ActivityFilters,
  cursor: string,
  limit = HISTORY_LIMIT,
): Promise<ActivityHistoryPage> {
  try {
    return await api<ActivityHistoryPage>("/v1/activity", {
      query: buildActivityQuery(filters, cursor, limit),
    });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (!status || status === 404 || status === 503) {
      return { events: [], next_cursor: undefined };
    }
    throw err;
  }
}

/** Loads the cursor-paginated activity history for `filters`. */
export function useActivityHistory(filters: ActivityFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["activity-history", filters] as const,
    queryFn: ({ pageParam }: { pageParam: string }) => fetchActivityPage(filters, pageParam),
    initialPageParam: "",
    getNextPageParam: (page: ActivityHistoryPage) => page.next_cursor ?? undefined,
    enabled,
    staleTime: 30_000,
    meta: { silent: true },
  });
}
