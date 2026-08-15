// Related-events list for the drawer's "Related events" tab. Correlates the
// selected event by shared request_id and same-actor time window
// (GET /v1/activity/{id}/related). Selecting a related event swaps the drawer to
// it. Reuses the compact EventCard so rows match the dashboard widget.

import { EmptyState, Skeleton } from "@qeetrix/ui";
import { LinkIcon } from "lucide-react";

import { useRelatedEvents } from "../activity-related-service";
import type { ActivityEvent } from "../types";
import { EventCard } from "./event-card";

function Section({
  title,
  hint,
  events,
  onSelect,
}: {
  title: string;
  hint: string;
  events: ActivityEvent[];
  onSelect?: (e: ActivityEvent) => void;
}) {
  if (events.length === 0) return null;
  return (
    <section aria-label={title}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
        <span className="text-[10px] text-muted-foreground">{hint}</span>
      </div>
      <div className="overflow-hidden rounded-md border border-border/60">
        {events.map((e, i) => (
          <div key={e.id} className={i > 0 ? "border-t border-border/50" : undefined}>
            <EventCard event={e} compact onClick={onSelect ? () => onSelect(e) : undefined} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function RelatedEventsList({
  eventId,
  onSelect,
}: {
  eventId: string;
  onSelect?: (e: ActivityEvent) => void;
}) {
  const { data, isLoading } = useRelatedEvents(eventId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {["a", "b", "c"].map((k) => (
          <Skeleton key={k} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  const byRequest = data?.by_request_id ?? [];
  const byActor = data?.by_actor ?? [];

  if (byRequest.length === 0 && byActor.length === 0) {
    return (
      <EmptyState
        icon={LinkIcon}
        title="No related events"
        description="Nothing else shares this event's request or actor in the surrounding window."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Same request"
        hint={`${byRequest.length} event${byRequest.length === 1 ? "" : "s"}`}
        events={byRequest}
        onSelect={onSelect}
      />
      <Section
        title="Same actor nearby"
        hint={`${byActor.length} event${byActor.length === 1 ? "" : "s"}`}
        events={byActor}
        onSelect={onSelect}
      />
    </div>
  );
}
