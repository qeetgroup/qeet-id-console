// Activity tab — the full identity timeline, embedded in-place (rather than
// navigating to /users/$userId/timeline). Reuses the timeline feature verbatim.

import { EmptyState } from "@qeetrix/ui";
import { ShieldIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ActivityEvent } from "@/features/activity/types";
import { IdentityTimeline } from "@/features/timeline/components/identity-timeline";
import { TimelineDetailsDrawer } from "@/features/timeline/components/timeline-details-drawer";
import { TimelineFilters } from "@/features/timeline/components/timeline-filters";
import { TimelineProvider, useTimeline } from "@/features/timeline/timeline-provider";

export function ActivityTab({ userId, canView }: { userId: string; canView: boolean }) {
  const { t } = useTranslation("users");
  if (!canView) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border bg-card">
        <EmptyState
          icon={ShieldIcon}
          title={t("detail.activityRestrictedTitle")}
          description={t("detail.activityRestrictedDesc")}
        />
      </div>
    );
  }
  return (
    <TimelineProvider userId={userId}>
      <ActivityTimelineInner userId={userId} />
    </TimelineProvider>
  );
}

function ActivityTimelineInner({ userId }: { userId: string }) {
  const {
    events,
    groups,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    retry,
    setSelectedEventId,
    selectedEventId,
  } = useTimeline();

  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);

  const handleSelectEvent = useCallback(
    (event: ActivityEvent) => {
      setSelectedEvent(event);
      setSelectedEventId(event.id);
    },
    [setSelectedEventId],
  );

  const handleCloseDrawer = useCallback(() => {
    setSelectedEvent(null);
    setSelectedEventId(null);
  }, [setSelectedEventId]);

  const selectedIndex = useMemo(
    () => events.findIndex((e) => e.id === selectedEvent?.id),
    [events, selectedEvent],
  );
  const prevEvent = selectedIndex > 0 ? events[selectedIndex - 1] : null;
  const nextEvent =
    selectedIndex >= 0 && selectedIndex < events.length - 1 ? events[selectedIndex + 1] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-card p-4">
        <TimelineFilters />
      </div>
      <div className="min-h-96 overflow-hidden rounded-xl border bg-card">
        <IdentityTimeline
          groups={groups}
          isLoadingHistory={isLoading}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          onLoadMore={fetchNextPage}
          onSelectEvent={handleSelectEvent}
          selectedEventId={selectedEventId}
          isError={isError}
          onRetry={retry}
        />
      </div>
      <TimelineDetailsDrawer
        event={selectedEvent}
        userId={userId}
        prevEvent={prevEvent}
        nextEvent={nextEvent}
        onClose={handleCloseDrawer}
        onSelectPrev={prevEvent ? () => handleSelectEvent(prevEvent) : undefined}
        onSelectNext={nextEvent ? () => handleSelectEvent(nextEvent) : undefined}
      />
    </div>
  );
}
