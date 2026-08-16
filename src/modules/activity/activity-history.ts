// TanStack Query hook for fetching the historical activity event log
// via GET /v1/activity with cursor-based pagination.
// 404 and network errors are treated as empty pages to prevent console crashes
// when the backend endpoint is not yet deployed.

import { useInfiniteQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";

import type { ActivityEvent, ActivityFilters } from "./activity.types";

export type ActivityHistoryPage = {
  events: ActivityEvent[];
  next_cursor?: string;
};

const HISTORY_LIMIT = 50;

/** Builds the /v1/activity query string for a filter set + cursor. Exported so
 *  the export loop (activity-export.ts) sends exactly the same predicates. */
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
 * Fetches one page of history from GET /v1/activity. Treats 404 (not deployed)
 * and network errors as empty pages so the page degrades gracefully while the
 * backend is being rolled out. Shared by the infinite query and the exporter.
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

/**
 * Loads paginated historical activity events from GET /v1/activity.
 */
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
