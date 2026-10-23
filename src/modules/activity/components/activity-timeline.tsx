import { Button, cn, EmptyState, ScrollArea, Skeleton, usePrefersReducedMotion } from "@qeetrix/ui";
import { ActivityIcon, RefreshCwIcon, WifiOffIcon } from "@qeetrix/icons";
import { useEffect, useRef } from "react";

import type { ActivitySearch } from "../activity-search";
import type { ActivityEvent, ConnectionStatus, DateGroup } from "../types/activity.types";
import { ActivityEventRow, ActivityRowHeader } from "./activity-event-row";

function GroupHeader({ label, date }: { label: string; date?: string }) {
  const dateStr = date
    ? new Date(date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/50 bg-card/95 px-3 py-2 backdrop-blur-sm lg:px-4">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {dateStr && <span className="text-muted-foreground/70"> • {dateStr}</span>}
      </span>
    </div>
  );
}

const SKELETON_IDS = ["a", "b", "c", "d", "e"] as const;

function EventSkeletons() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      {SKELETON_IDS.map((id) => (
        <div key={id} className="flex gap-3 rounded-lg border border-border/40 p-4">
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-56 max-w-full" />
            <Skeleton className="h-2.5 w-36 max-w-full" />
          </div>
          <Skeleton className="h-2.5 w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
}

type ActivityTimelineProps = {
  groups: DateGroup[];
  newEventIds: ReadonlySet<string>; // Events to highlight as newly arrived
  status: ConnectionStatus;
  isLoadingHistory: boolean; // The first history page is loading
  isFetchingNextPage: boolean; // A later history page is loading
  hasNextPage: boolean;
  onLoadMore: () => void; // Called when the bottom sentinel comes within 200px of the viewport
  onSelectEvent: (event: ActivityEvent) => void;
  /** Receives filter patches from a row's investigate menu. */
  onFilter?: (patch: Partial<ActivitySearch>) => void;
  selectedEventId?: string | null; // The row to mark as selected
  isError?: boolean; // History failed with an error that isn't degraded to an empty page
  onRetryHistory?: () => void;
  onRetryStream?: () => void;
  /** Hides the "All events loaded" marker, e.g. when a pager follows the feed. */
  hideEndMarker?: boolean;
};

/**
 * Renders the date-grouped activity feed, highlighting new arrivals and loading more history
 * as the bottom sentinel scrolls into view. It isn't virtualized: live events are capped at
 * MAX_LIVE and history loads a page at a time.
 */
export function ActivityTimeline({
  groups,
  newEventIds,
  status,
  isLoadingHistory,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  onSelectEvent,
  onFilter,
  selectedEventId,
  isError = false,
  onRetryHistory,
  onRetryStream,
  hideEndMarker = false,
}: ActivityTimelineProps) {
  const reducedMotion = usePrefersReducedMotion();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onLoadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, onLoadMore]);

  if (isLoadingHistory && groups.length === 0) {
    return (
      <div className="px-1 py-2">
        <EventSkeletons />
      </div>
    );
  }

  if (isError && groups.length === 0) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <EmptyState
          icon={RefreshCwIcon}
          title="Couldn't load activity history"
          description="There was a problem fetching the event log. Your live stream may still be working."
          action={
            onRetryHistory && (
              <Button variant="outline" size="sm" onClick={onRetryHistory}>
                <RefreshCwIcon className="size-3.5" aria-hidden="true" />
                Retry
              </Button>
            )
          }
        />
      </div>
    );
  }

  if (status === "reconnecting" && groups.length === 0) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center gap-4 px-4">
        <p
          className="text-sm font-medium text-muted-foreground"
          aria-live="polite"
          aria-atomic="true"
        >
          Reconnecting to live stream…
        </p>
        <div className="w-full max-w-lg px-1">
          <EventSkeletons />
        </div>
      </div>
    );
  }

  if (status === "disconnected" && groups.length === 0) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <EmptyState
          icon={WifiOffIcon}
          title="Stream unavailable"
          description="The live event stream could not be established after several attempts."
          action={
            onRetryStream && (
              <Button variant="outline" size="sm" onClick={onRetryStream}>
                <RefreshCwIcon className="size-3.5" aria-hidden="true" />
                Retry connection
              </Button>
            )
          }
        />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <EmptyState
          icon={ActivityIcon}
          title="No events yet"
          description="Live events will appear here as they stream in. Historical events load as you scroll."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Decorative; wide viewports only */}
      <ActivityRowHeader />
      <ScrollArea className="flex-1">
        {/*
          A feed is not a live region, so it carries no aria-live; the page announces
          critical events in its own assertive region.
        */}
        <div
          role="feed"
          aria-label="Activity event feed"
          aria-busy={status === "reconnecting"}
          className="flex flex-col pb-6"
        >
          {groups.map((group) => (
            <section key={group.label} aria-label={`${group.label} events`}>
              <GroupHeader label={group.label} date={group.events[0]?.at} />
              <div className={reducedMotion ? "" : "motion-safe:transition-all"}>
                {group.events.map((event, index) => {
                  const isNew = newEventIds.has(event.id);
                  const isSelected = event.id === selectedEventId;

                  return (
                    <div
                      key={event.id}
                      className={cn(
                        isNew && !reducedMotion && "motion-safe:animate-in motion-safe:fade-in-0",
                      )}
                      // Staggered so a burst of new events doesn't pop in all at once
                      style={
                        isNew && !reducedMotion
                          ? { animationDelay: `${Math.min(index * 40, 400)}ms` }
                          : undefined
                      }
                    >
                      <ActivityEventRow
                        event={event}
                        isNew={isNew}
                        isSelected={isSelected}
                        onSelect={() => onSelectEvent(event)}
                        onFilter={onFilter}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Infinite scroll sentinel */}
          {hasNextPage && (
            <div ref={sentinelRef} className="py-2" aria-hidden="true">
              {isFetchingNextPage && (
                <div className="px-1">
                  <EventSkeletons />
                </div>
              )}
            </div>
          )}

          {!hasNextPage && groups.length > 0 && !hideEndMarker && (
            <p className="py-4 text-center text-[11px] text-muted-foreground" aria-live="polite">
              All events loaded
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
