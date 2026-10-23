import { useStore } from "@tanstack/react-store";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { useCapabilities } from "@/platform/security/capability-provider";
import { applyFilters } from "@/modules/activity";
import type { ActivityEvent, DateGroup } from "@/modules/activity";
import { groupTimelineByDate } from "./grouping";
import { type TimelineFilters, timelineActions, timelineStore } from "./timeline-store";
import { useIdentityTimeline } from "./use-identity-timeline";

export type TimelineContextValue = {
  events: ActivityEvent[]; // Loaded events after filtering, newest first
  groups: DateGroup[]; // `events` in date buckets
  filters: TimelineFilters;
  selectedEventId: string | null; // The event open in the details drawer
  setFilters: (patch: Partial<TimelineFilters>) => void;
  resetFilters: () => void;
  setSelectedEventId: (id: string | null) => void;
  isLoading: boolean; // The first page is loading
  isFetchingNextPage: boolean; // A later page is loading
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isError: boolean; // A fetch failed with an error that isn't degraded to an empty page
  retry: () => void;
};

const TimelineContext = createContext<TimelineContextValue | null>(null);

/**
 * Provides a user's identity timeline: the loaded events, filtered client-side and grouped by
 * date, with the shared filter and selection state.
 */
export function TimelineProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const access = useCapabilities();
  const canRead = access.can("audit.read") && access.can("user.read");

  const filters = useStore(timelineStore, (s) => s.filters);
  const selectedEventId = useStore(timelineStore, (s) => s.selectedEventId);

  // Clears the drawer selection when the viewed user changes; skipped on the first render.
  const prevUserIdRef = useRef(userId);
  useEffect(() => {
    if (prevUserIdRef.current === userId) return;
    prevUserIdRef.current = userId;
    timelineActions.clearSelection();
  }, [userId]);

  const query = useIdentityTimeline(userId, filters, canRead);

  const allEvents = useMemo(() => query.data?.pages.flatMap((p) => p.events) ?? [], [query.data]);

  // TimelineFilters in ActivityFilters shape, to reuse applyFilters; the other fields stay empty.
  const activityFilters = useMemo(
    () => ({
      types: [] as string[],
      severity: filters.severity,
      category: filters.category,
      actor: "",
      q: filters.q,
      from: filters.from,
      to: filters.to,
      source: "",
      status: "",
      ip: "",
      resource: "",
    }),
    [filters],
  );

  // Filtering the loaded events here gives instant feedback before the refetch lands.
  const filteredEvents = useMemo(
    () => applyFilters(allEvents, activityFilters),
    [allEvents, activityFilters],
  );

  const groups = useMemo(() => groupTimelineByDate(filteredEvents), [filteredEvents]);

  const fetchNextPage = useCallback(() => {
    void query.fetchNextPage();
  }, [query.fetchNextPage]);

  const retry = useCallback(() => {
    void query.refetch();
  }, [query.refetch]);

  const value = useMemo<TimelineContextValue>(
    () => ({
      events: filteredEvents,
      groups,
      filters,
      selectedEventId,
      setFilters: timelineActions.setFilters,
      resetFilters: timelineActions.resetFilters,
      setSelectedEventId: timelineActions.setSelectedEventId,
      isLoading: query.isLoading,
      isFetchingNextPage: query.isFetchingNextPage,
      hasNextPage: query.hasNextPage,
      fetchNextPage,
      isError: query.isError,
      retry,
    }),
    [
      filteredEvents,
      groups,
      filters,
      selectedEventId,
      query.isLoading,
      query.isFetchingNextPage,
      query.hasNextPage,
      query.isError,
      fetchNextPage,
      retry,
    ],
  );

  return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}

export function useTimeline(): TimelineContextValue {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error("useTimeline must be used inside TimelineProvider");
  return ctx;
}
