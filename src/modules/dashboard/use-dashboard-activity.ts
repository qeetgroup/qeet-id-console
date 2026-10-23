import { useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useEffect, useMemo } from "react";

import { useCapabilities } from "@/platform/security/capability-provider";
import { fetchActivityPage } from "@/modules/activity";
import { activityStore } from "@/modules/activity";
import { acquireSubscription } from "@/modules/activity";
import { type ActivityEvent, type ConnectionStatus, DEFAULT_FILTERS } from "@/modules/activity";
import { useTenantId } from "@/platform/auth/session";
import { dashboardKeys } from "./api/keys";

const DASHBOARD_LIMIT = 10;
const REFRESH_MS = 20_000;

export type { ActivityEvent as DashboardAuditEvent };

export type DashboardActivityResult = {
  events: ActivityEvent[];
  status: ConnectionStatus;
  connecting: boolean; // loading with nothing to show yet
};

/**
 * Returns the dashboard's latest activity: polled history merged with live SSE events, de-duped and
 * newest-first. Polling keeps it current while the stream is down. `_tenantId` is ignored; the
 * tenant comes from the session.
 */
export function useDashboardActivity(_tenantId?: string, enabled = true): DashboardActivityResult {
  const access = useCapabilities();
  const canRead = access.can("audit.read");
  const tenantId = useTenantId();
  const active = enabled && canRead;

  const liveEvents = useStore(activityStore, (s) => s.liveEvents);
  const status = useStore(activityStore, (s) => s.status);

  const history = useQuery({
    queryKey: dashboardKeys.activity(tenantId),
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
    // Live events go in first, so they win over the history copy of the same event.
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
