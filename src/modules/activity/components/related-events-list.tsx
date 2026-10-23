import { useTranslation } from "react-i18next";
import { EmptyState, Skeleton } from "@qeetrix/ui";
import { LinkIcon } from "@qeetrix/icons";

import { useRelatedEvents } from "../related-events";
import type { ActivityEvent } from "../types/activity.types";
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

/** Renders the events sharing this event's request, and the same actor's nearby events. */
export function RelatedEventsList({
  eventId,
  onSelect,
}: {
  eventId: string;
  onSelect?: (e: ActivityEvent) => void;
}) {
  const { t } = useTranslation("activity");
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
        title={t("relatedEventsList.noRelatedEvents")}
        description={t("relatedEventsList.nothingElseSharesThis")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Section
        title={t("relatedEventsList.sameRequest")}
        hint={`${byRequest.length} event${byRequest.length === 1 ? "" : "s"}`}
        events={byRequest}
        onSelect={onSelect}
      />
      <Section
        title={t("relatedEventsList.sameActorNearby")}
        hint={`${byActor.length} event${byActor.length === 1 ? "" : "s"}`}
        events={byActor}
        onSelect={onSelect}
      />
    </div>
  );
}
