import { useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";

import type { ActivityFilters, ActivitySummary } from "./types/activity.types";
import { useTenantId } from "@/platform/auth/session";
import { activityKeys } from "./api/keys";

const LIVE_REFETCH_MS = 30_000;

// Only the predicates the summary accepts; it ignores severity and category because it
// reports their distribution.
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
 * Loads the server-computed activity summary for the filter window, polling in live mode. It is
 * never incremented from the SSE stream, which would double-count and drift. Resolves to
 * undefined on a 404, 503 or network error so callers can hide the strip.
 */
export function useActivitySummary(
  filters: ActivityFilters,
  opts: { live?: boolean; enabled?: boolean } = {},
) {
  const { live = true, enabled = true } = opts;
  const tenantId = useTenantId();
  return useQuery({
    queryKey: activityKeys.summary(tenantId, summaryQuery(filters)),
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
