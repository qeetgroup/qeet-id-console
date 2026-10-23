import {
  Button,
  cn,
  EmptyState,
  ScrollArea,
  Separator,
  Skeleton,
  Timeline,
  usePrefersReducedMotion,
} from "@qeetrix/ui";
import { ActivityIcon, RefreshCwIcon } from "@qeetrix/icons";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { ActivityEvent, DateGroup } from "@/modules/activity";
import { TimelineItem } from "./timeline-item";

function GroupHeader({ label }: { label: string }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/90 py-2 backdrop-blur-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}

const SKELETON_IDS = ["a", "b", "c", "d"] as const;

function TimelineSkeletons() {
  const { t } = useTranslation("timeline");
  return (
    <div
      role="status"
      aria-label={t("identityTimeline.loadingTimelineEvents")}
      className="flex flex-col gap-3 pl-5"
    >
      {SKELETON_IDS.map((id) => (
        <div key={id} className="flex gap-3">
          <Skeleton className="size-7 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-3.5 w-48 max-w-full" />
            <Skeleton className="h-2.5 w-32 max-w-full" />
          </div>
          <Skeleton className="h-2.5 w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
}

type IdentityTimelineProps = {
  groups: DateGroup[];
  isLoadingHistory: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  onSelectEvent: (event: ActivityEvent) => void;
  selectedEventId?: string | null;
  isError?: boolean;
  onRetry?: () => void;
};

/**
 * Renders a user's date-grouped timeline as an ordered list, loading the next page as the
 * bottom sentinel comes within 200px of the viewport. It isn't virtualized; the list grows a
 * page at a time.
 */
export function IdentityTimeline({
  groups,
  isLoadingHistory,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  onSelectEvent,
  selectedEventId,
  isError = false,
  onRetry,
}: IdentityTimelineProps) {
  const { t } = useTranslation(["timeline", "activity"]);
  const reducedMotion = usePrefersReducedMotion();
  const sentinelRef = useRef<HTMLLIElement>(null);

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
      <div className="px-1 py-4">
        <TimelineSkeletons />
      </div>
    );
  }

  if (isError && groups.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <EmptyState
          icon={RefreshCwIcon}
          title={t("identityTimeline.couldnTLoadTimeline")}
          description={t("identityTimeline.thereWasAProblem")}
          action={
            onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCwIcon className="size-3.5" aria-hidden="true" />
                {t("identityTimeline.retry")}
              </Button>
            )
          }
        />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <EmptyState
          icon={ActivityIcon}
          title={t("identityTimeline.noEventsFound")}
          description={t("identityTimeline.noActivityEventsMatch")}
        />
      </div>
    );
  }

  // aria-posinset / aria-setsize count across all groups.
  const totalEvents = groups.reduce((acc, g) => acc + g.events.length, 0);
  let globalIndex = 0;

  return (
    <ScrollArea className="flex-1">
      {/* Historical data: an ordered list, deliberately not a live region */}
      <ol
        aria-label={t("identityTimeline.identityTimelineEvents")}
        className="flex flex-col gap-0 px-1 pb-6"
      >
        {groups.map((group) => (
          <li key={group.key}>
            <section
              aria-label={t("activity:dateGroup.events", {
                label: t(`activity:dateGroup.${group.key}`),
              })}
            >
              <GroupHeader label={t(`activity:dateGroup.${group.key}`)} />

              {/* @qeetrix/ui Timeline provides the vertical connector rail */}
              <Timeline>
                {group.events.map((event, index) => {
                  const itemIndex = ++globalIndex;
                  const isSelected = event.id === selectedEventId;

                  return (
                    <div
                      key={event.id}
                      className={cn(
                        !reducedMotion && index === 0
                          ? "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
                          : "",
                      )}
                    >
                      <TimelineItem
                        event={event}
                        isSelected={isSelected}
                        isCurrent={isSelected}
                        onClick={onSelectEvent}
                        posInSet={itemIndex}
                        setSize={totalEvents}
                      />
                    </div>
                  );
                })}
              </Timeline>
            </section>
          </li>
        ))}

        {/* Infinite scroll sentinel */}
        {hasNextPage && (
          <li ref={sentinelRef} className="py-2" aria-hidden="true">
            {isFetchingNextPage && (
              <div className="px-1">
                <TimelineSkeletons />
              </div>
            )}
          </li>
        )}

        {!hasNextPage && groups.length > 0 && (
          <li>
            <p
              className="py-4 text-center text-[11px] text-muted-foreground"
              aria-live="polite"
              aria-atomic="true"
            >
              {t("identityTimeline.allLoaded", { count: totalEvents })}
            </p>
          </li>
        )}
      </ol>
    </ScrollArea>
  );
}
