import { useInfiniteQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";

import type { ActivityEvent, ActivityFilters, Severity } from "./types/activity.types";
import { useTenantId } from "@/platform/auth/session";
import { activityKeys } from "./api/keys";

export type ActivityHistoryPage = {
  events: ActivityEvent[];
  next_cursor?: string;
};

const HISTORY_LIMIT = 50;
/** The Activity page reads the log 100 events at a time (the server allows up to 200). */
export const ACTIVITY_PAGE_LIMIT = 100;

const SEVERITY_ORDER: Severity[] = ["info", "success", "warning", "error", "critical"];

/**
 * The server's `severity` is a minimum (info < success < warning < error < critical), not a list:
 * send the lowest one chosen, and the browser keeps only the chosen ones from what comes back.
 */
export function minimumSeverity(severity: Severity[]): Severity | undefined {
  return SEVERITY_ORDER.find((s) => severity.includes(s));
}

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
    severity: minimumSeverity(filters.severity),
    // The server matches one category exactly; several are matched in the browser.
    category: filters.category.length === 1 ? filters.category[0] : undefined,
    actor: filters.actor || undefined,
    q: filters.q || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
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

/**
 * Loads the cursor-paginated activity history for `filters`, ACTIVITY_PAGE_LIMIT events a page.
 * It isn't refetched on focus: the Activity page adds newer events itself, and a refetch would
 * move the rows under the reader.
 */
export function useActivityHistory(filters: ActivityFilters, enabled = true) {
  const tenantId = useTenantId();
  return useInfiniteQuery({
    queryKey: activityKeys.history(tenantId, filters),
    queryFn: ({ pageParam }: { pageParam: string }) =>
      fetchActivityPage(filters, pageParam, ACTIVITY_PAGE_LIMIT),
    initialPageParam: "",
    getNextPageParam: (page: ActivityHistoryPage) => page.next_cursor ?? undefined,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    meta: { silent: true },
  });
}
