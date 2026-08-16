// TanStack Query hook for the aggregate summary strip (GET /v1/activity/summary).
// The summary is a server-computed windowed snapshot — it is NEVER incremented
// from the live SSE stream (that would double-count and drift from the server).
// In live mode it is polled on an interval; in history mode the window is pinned
// so the query is static. 404 (not yet deployed) resolves to undefined so the
// strip hides gracefully rather than crashing the page.

import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";

import type { ActivityFilters, ActivitySummary } from "./types";

const LIVE_REFETCH_MS = 30_000;

// The summary honours the same SQL-pushable predicates as history, but ignores
// severity/category (it produces that distribution). We send only what it uses.
function summaryQuery(filters: ActivityFilters): Record<string, string | number | undefined> {
  return {
    types: filters.types.join(",") || undefined,
    actor: filters.actor || undefined,
    q: filters.q || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  };
}

/**
 * Loads the aggregate activity summary for the current filter window. Returns
 * `undefined` (not an error) when the endpoint is unavailable so callers can
 * hide the strip. In live mode it refetches every 30s.
 */
export function useActivitySummary(
  filters: ActivityFilters,
  opts: { live?: boolean; enabled?: boolean } = {},
) {
  const { live = true, enabled = true } = opts;
  return useQuery({
    queryKey: ["activity-summary", summaryQuery(filters)] as const,
    queryFn: async (): Promise<ActivitySummary | undefined> => {
      try {
        return await api<ActivitySummary>("/v1/activity/summary", { query: summaryQuery(filters) });
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (!status || status === 404 || status === 503) return undefined;
        throw err;
      }
    },
    enabled,
    staleTime: 15_000,
    refetchInterval: live ? LIVE_REFETCH_MS : false,
    meta: { silent: true },
  });
}
