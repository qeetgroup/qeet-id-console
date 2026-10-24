import { useStore } from "@tanstack/react-store";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useCapabilities } from "@/platform/security/capability-provider";
import { useActivityHistory } from "./activity-history";
import { activityActions, activityStore, initActivityPrefs } from "./activity-store";
import { applyFilters, groupByDate } from "./activity-filters";
import { acquireSubscription, restartStream } from "./activity-subscription";
import {
  type ActivityEvent,
  type ActivityFilters,
  type ConnectionStatus,
  type DateGroup,
  DEFAULT_FILTERS,
} from "./types/activity.types";

type ActivityContextValue = {
  filteredEvents: ActivityEvent[]; // Live then historical events, newest first, after filtering
  allEvents: ActivityEvent[]; // Live then historical events before filtering, for the facet options
  groups: DateGroup[]; // `filteredEvents` bucketed into Today / Yesterday / This Week / Older
  unreadCount: number; // Live events added since the last markAllRead()
  paused: boolean; // While paused, live events queue in the store but don't render
  status: ConnectionStatus;
  filters: ActivityFilters;
  setFilters: (patch: Partial<ActivityFilters>) => void;
  resetFilters: () => void;
  markAllRead: () => void;
  pause: () => void;
  resume: () => void;
  isLoadingHistory: boolean; // The first history page is loading
  isFetchingNextPage: boolean; // A later history page is loading
  hasNextPage: boolean;
  fetchNextPage: () => void;
  /** IDs of live events that arrived after this provider mounted, for "new" highlights. */
  newEventIds: ReadonlySet<string>;
  isHistoryError: boolean; // History failed with an error that isn't degraded to an empty page
  retryHistory: () => void;
  retryStream: () => void; // Restarts the SSE stream after it has given up reconnecting
};

const ActivityContext = createContext<ActivityContextValue | null>(null);

/**
 * Provides the Live Activity Center's merged live + history events, filters and stream
 * controls, and holds the shared SSE subscription while mounted.
 */
export function ActivityProvider({
  children,
  filters: controlledFilters,
  onFiltersChange,
}: {
  children: ReactNode;
  /** Makes the provider controlled (URL-driven); omit to keep filters in local state. */
  filters?: ActivityFilters;
  /** Receives the filter patch when a consumer changes filters in controlled mode. */
  onFiltersChange?: (patch: Partial<ActivityFilters>) => void;
}) {
  const access = useCapabilities();
  const canRead = access.can("audit.read");

  const liveEvents = useStore(activityStore, (s) => s.liveEvents);
  const unreadCount = useStore(activityStore, (s) => s.unreadCount);
  const paused = useStore(activityStore, (s) => s.paused);
  const status = useStore(activityStore, (s) => s.status);

  const isControlled = controlledFilters !== undefined;
  const [internalFilters, setFiltersState] = useState<ActivityFilters>(DEFAULT_FILTERS);
  const filters = controlledFilters ?? internalFilters;

  // Events already in the store at mount aren't highlighted as new after navigation.
  const seedIdsRef = useRef<ReadonlySet<string> | null>(null);
  if (seedIdsRef.current === null) {
    seedIdsRef.current = new Set(liveEvents.map((e) => e.id));
  }

  useEffect(() => {
    initActivityPrefs();
  }, []);

  useEffect(() => {
    if (!canRead) return;
    return acquireSubscription();
  }, [canRead]);

  const history = useActivityHistory(filters, canRead);

  const allEvents = useMemo(() => {
    const historyEvents = (history.data?.pages ?? []).flatMap((p) => p.events);
    // Both lists are newest-first and live events are the newest, so live-then-history
    // stays newest-first; history copies of live events are dropped.
    const liveIds = new Set(liveEvents.map((e) => e.id));
    const uniqueHistory = historyEvents.filter((e) => !liveIds.has(e.id));
    return [...liveEvents, ...uniqueHistory];
  }, [liveEvents, history.data]);

  const filteredEvents = useMemo(() => applyFilters(allEvents, filters), [allEvents, filters]);
  const groups = useMemo(() => groupByDate(filteredEvents), [filteredEvents]);

  const newEventIds = useMemo<ReadonlySet<string>>(() => {
    const seed = seedIdsRef.current;
    if (!seed) return new Set<string>();
    const newIds = new Set<string>();
    for (const e of liveEvents) {
      if (!seed.has(e.id)) newIds.add(e.id);
    }
    return newIds;
  }, [liveEvents]);

  const setFilters = useCallback(
    (patch: Partial<ActivityFilters>) => {
      if (isControlled) {
        onFiltersChange?.(patch);
      } else {
        setFiltersState((prev) => ({ ...prev, ...patch }));
      }
    },
    [isControlled, onFiltersChange],
  );
  const resetFilters = useCallback(() => {
    if (isControlled) {
      onFiltersChange?.(DEFAULT_FILTERS);
    } else {
      setFiltersState(DEFAULT_FILTERS);
    }
  }, [isControlled, onFiltersChange]);
  const fetchNextPage = useCallback(() => {
    void history.fetchNextPage();
  }, [history.fetchNextPage]);

  const retryHistory = useCallback(() => {
    void history.refetch();
  }, [history.refetch]);

  const value = useMemo<ActivityContextValue>(
    () => ({
      filteredEvents,
      allEvents,
      groups,
      unreadCount,
      paused,
      status,
      filters,
      setFilters,
      resetFilters,
      markAllRead: activityActions.markAllRead,
      pause: () => activityActions.setPaused(true),
      resume: () => activityActions.setPaused(false),
      isLoadingHistory: history.isLoading,
      isFetchingNextPage: history.isFetchingNextPage,
      hasNextPage: history.hasNextPage,
      fetchNextPage,
      newEventIds,
      isHistoryError: history.isError,
      retryHistory,
      retryStream: restartStream,
    }),
    [
      filteredEvents,
      allEvents,
      groups,
      unreadCount,
      paused,
      status,
      filters,
      setFilters,
      resetFilters,
      history.isLoading,
      history.isFetchingNextPage,
      history.hasNextPage,
      history.isError,
      fetchNextPage,
      newEventIds,
      retryHistory,
    ],
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivity(): ActivityContextValue {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error("useActivity must be used inside ActivityProvider");
  return ctx;
}
