// Dashboard activity widget data source.
//
// Reads from two sources and merges them so the widget is populated and fresh
// regardless of SSE health:
//   1. Recent history via GET /v1/activity (react-query, short interval) — this
//      is what makes the widget show recent events on load and refresh when the
//      operator changes something elsewhere, even when the live stream is down.
//   2. Live SSE events from the shared activityStore — instant updates while the
//      stream is connected.
// The two are de-duped by id and shown newest-first.

import { useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useEffect, useMemo } from "react";

import { useCapabilities } from "@/features/access-control/capability-provider";
import { fetchActivityPage } from "@/features/activity/activity-service";
import { activityStore } from "@/features/activity/activity-store";
import { acquireSubscription } from "@/features/activity/subscription-manager";
import { type ActivityEvent, type ConnectionStatus, DEFAULT_FILTERS } from "@/features/activity/types";
import { useTenantId } from "@/lib/auth";

const DASHBOARD_LIMIT = 10;
const REFRESH_MS = 20_000;

export type { ActivityEvent as DashboardAuditEvent };

export type DashboardActivityResult = {
  events: ActivityEvent[];
  status: ConnectionStatus;
  /** True while loading with nothing to show yet. */
  connecting: boolean;
};

/**
 * Hook for the dashboard activity widget. Merges recently-loaded history with
 * live SSE events (deduped, newest-first). History refetches on an interval and
 * on window focus, so the widget stays current even without a live stream.
 */
export function useDashboardActivity(_tenantId?: string, enabled = true): DashboardActivityResult {
  const access = useCapabilities();
  const canRead = access.can("audit.read");
  const tenantId = useTenantId();
  const active = enabled && canRead;

  const liveEvents = useStore(activityStore, (s) => s.liveEvents);
  const status = useStore(activityStore, (s) => s.status);

  // Recent history — keeps the widget populated + fresh independent of SSE.
  const history = useQuery({
    queryKey: ["dashboard-activity", tenantId] as const,
    queryFn: () => fetchActivityPage(DEFAULT_FILTERS, "", DASHBOARD_LIMIT),
    enabled: active && !!tenantId,
    staleTime: 10_000,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
    meta: { silent: true },
  });

  useEffect(() => {
    if (!active) return;
    return acquireSubscription();
  }, [active]);

  const events = useMemo(() => {
    const merged = new Map<string, ActivityEvent>();
    // Live first (freshest), then history; the Map keeps the first-seen entry.
    for (const e of liveEvents) merged.set(e.id, e);
    for (const e of history.data?.events ?? []) if (!merged.has(e.id)) merged.set(e.id, e);
    return Array.from(merged.values())
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .slice(0, DASHBOARD_LIMIT);
  }, [liveEvents, history.data]);

  return {
    events,
    status,
    connecting: history.isLoading && events.length === 0,
  };
}
