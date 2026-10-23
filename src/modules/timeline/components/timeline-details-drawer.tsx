import {
  Badge,
  Button,
  JSONTree,
  ScrollArea,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  TimeSince,
} from "@qeetrix/ui";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  GlobeIcon,
  MonitorIcon,
  ServerIcon,
} from "@qeetrix/icons";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import {
  type ActivityEvent,
  formatEventTitle,
  ResultBadge,
  SeverityBadge,
} from "@/modules/activity";
import { TimelineQuickActions } from "./timeline-details-drawer-actions";
import {
  extractChanges,
  formatChangeValue,
  humanizeField,
} from "./timeline-details-drawer-changes";
import { CopyButton, DetailRow, SectionHeading } from "./timeline-details-drawer-fields";

type TimelineDetailsDrawerProps = {
  event: ActivityEvent | null; // The open event; null closes the drawer
  userId: string; // The timeline's user, whom the quick actions act on
  prevEvent?: ActivityEvent | null;
  nextEvent?: ActivityEvent | null;
  onClose: () => void;
  onSelectPrev?: () => void;
  onSelectNext?: () => void;
};

/**
 * Renders a timeline event in a side sheet: its fields, before → after changes, correlation IDs,
 * actor, resource, request context and metadata, with prev/next navigation and quick actions.
 */
export function TimelineDetailsDrawer({
  event,
  userId,
  prevEvent,
  nextEvent,
  onClose,
  onSelectPrev,
  onSelectNext,
}: TimelineDetailsDrawerProps) {
  const { t } = useTranslation("timeline");

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose],
  );

  const correlationId =
    typeof event?.metadata?.correlation_id === "string"
      ? event.metadata.correlation_id
      : typeof event?.metadata?.trace_id === "string"
        ? event.metadata.trace_id
        : null;

  const changes = extractChanges(event?.metadata);

  return (
    <Sheet open={!!event} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        {event ? (
          <>
            {/* Header */}
            <SheetHeader className="border-b border-border/60 p-4">
              <div className="flex items-start gap-3 pr-8">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-sm">{formatEventTitle(event)}</SheetTitle>
                  {event.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{event.description}</p>
                  ) : null}
                  <SheetDescription className="mt-0.5 text-xs capitalize">
                    {event.category} ·{" "}
                    <TimeSince value={event.at} className="inline tabular-nums" />
                  </SheetDescription>
                </div>
                <ResultBadge event={event} />
              </div>

              {/* Prev / next navigation */}
              <div className="mt-2 flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={onSelectPrev}
                  disabled={!prevEvent || !onSelectPrev}
                  aria-label={t("timelineDetailsDrawer.previousEvent")}
                  className="size-7"
                >
                  <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={onSelectNext}
                  disabled={!nextEvent || !onSelectNext}
                  aria-label={t("timelineDetailsDrawer.nextEvent")}
                  className="size-7"
                >
                  <ChevronRightIcon className="size-3.5" aria-hidden="true" />
                </Button>
                <span className="text-[10px] text-muted-foreground">
                  {t("timelineDetailsDrawer.navigateEvents")}
                </span>
              </div>
            </SheetHeader>

            {/* Scrollable body */}
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-5 p-4">
                {/* Core event fields */}
                <section aria-label={t("timelineDetailsDrawer.eventDetails")}>
                  <dl className="flex flex-col gap-2.5">
                    <DetailRow label={t("timelineDetailsDrawer.eventId")}>
                      <span className="flex items-center gap-1.5">
                        <span className="max-w-48 truncate font-mono text-[10px]">{event.id}</span>
                        <CopyButton
                          text={event.id}
                          label={t("timelineDetailsDrawer.copyEventId")}
                        />
                      </span>
                    </DetailRow>
                    <DetailRow label={t("common:labels.type")}>
                      <Badge variant="muted">{event.type}</Badge>
                    </DetailRow>
                    <DetailRow label={t("timelineDetailsDrawer.category")}>
                      <span className="capitalize">{event.category}</span>
                    </DetailRow>
                    <DetailRow label={t("timelineDetailsDrawer.result")}>
                      <ResultBadge event={event} />
                    </DetailRow>
                    <DetailRow label={t("timelineDetailsDrawer.severity")}>
                      <SeverityBadge severity={event.severity} />
                    </DetailRow>
                    <DetailRow label={t("timelineDetailsDrawer.timestamp")}>
                      <time dateTime={event.at}>
                        {new Date(event.at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "long",
                        })}
                      </time>
                    </DetailRow>
                    {event.status && (
                      <DetailRow label={t("common:labels.status")}>
                        <Badge variant="outline">{event.status}</Badge>
                      </DetailRow>
                    )}
                    {event.source && (
                      <DetailRow label={t("timelineDetailsDrawer.source")}>
                        <span className="flex items-center gap-1">
                          <ServerIcon className="size-3 text-muted-foreground" aria-hidden="true" />
                          {event.source}
                        </span>
                      </DetailRow>
                    )}
                  </dl>
                </section>

                {/* Changes — before → after diff from the event payload */}
                {changes.length > 0 && (
                  <>
                    <Separator />
                    <section aria-label={t("timelineDetailsDrawer.changes")}>
                      <SectionHeading>{t("timelineDetailsDrawer.changes")}</SectionHeading>
                      <dl className="flex flex-col gap-2.5">
                        {changes.map((change) => (
                          <div
                            key={change.field}
                            className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3"
                          >
                            <dt className="text-xs font-medium text-muted-foreground">
                              {humanizeField(change.field)}
                            </dt>
                            <dd className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                              <Badge variant="outline" className="max-w-40 truncate line-through">
                                {formatChangeValue(change.before)}
                              </Badge>
                              <span aria-hidden="true" className="text-muted-foreground">
                                →
                              </span>
                              <Badge variant="success" className="max-w-40 truncate">
                                {formatChangeValue(change.after)}
                              </Badge>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  </>
                )}

                {/* Correlation / tracing — request + trace IDs for investigation */}
                {(event.request_id || correlationId) && (
                  <>
                    <Separator />
                    <section aria-label={t("timelineDetailsDrawer.correlationAndTracing")}>
                      <SectionHeading>
                        {t("timelineDetailsDrawer.correlationTracing")}
                      </SectionHeading>
                      <dl className="flex flex-col gap-2.5">
                        {event.request_id && (
                          <DetailRow label={t("timelineDetailsDrawer.requestId")}>
                            <span className="flex items-center gap-1.5">
                              <span className="max-w-48 truncate font-mono text-[10px]">
                                {event.request_id}
                              </span>
                              <CopyButton
                                text={event.request_id}
                                label={t("timelineDetailsDrawer.copyRequestId")}
                              />
                            </span>
                          </DetailRow>
                        )}
                        {correlationId && (
                          <DetailRow label={t("timelineDetailsDrawer.traceCorrId")}>
                            <span className="flex items-center gap-1.5">
                              <span className="max-w-48 truncate font-mono text-[10px]">
                                {correlationId}
                              </span>
                              <CopyButton
                                text={correlationId}
                                label={t("timelineDetailsDrawer.copyCorrelationId")}
                              />
                            </span>
                          </DetailRow>
                        )}
                      </dl>
                    </section>
                  </>
                )}

                {/* Actor */}
                {event.actor && (
                  <>
                    <Separator />
                    <section aria-label={t("timelineDetailsDrawer.actor")}>
                      <SectionHeading>{t("timelineDetailsDrawer.actor")}</SectionHeading>
                      <dl className="flex flex-col gap-2.5">
                        {event.actor.name && (
                          <DetailRow label={t("common:labels.name")}>{event.actor.name}</DetailRow>
                        )}
                        {event.actor.id && (
                          <DetailRow label="ID">
                            <span className="flex items-center gap-1.5">
                              <span className="max-w-48 truncate font-mono text-[10px]">
                                {event.actor.id}
                              </span>
                              <CopyButton
                                text={event.actor.id}
                                label={t("timelineDetailsDrawer.copyActorId")}
                              />
                            </span>
                          </DetailRow>
                        )}
                        {event.actor.type && (
                          <DetailRow label={t("common:labels.type")}>
                            <Badge variant="muted">{event.actor.type}</Badge>
                          </DetailRow>
                        )}
                      </dl>
                    </section>
                  </>
                )}

                {/* Target / affected resource */}
                {event.target && (
                  <>
                    <Separator />
                    <section aria-label={t("timelineDetailsDrawer.affectedResource")}>
                      <SectionHeading>{t("timelineDetailsDrawer.affectedResource")}</SectionHeading>
                      <dl className="flex flex-col gap-2.5">
                        {event.target.label && (
                          <DetailRow label={t("timelineDetailsDrawer.label")}>
                            {event.target.label}
                          </DetailRow>
                        )}
                        {event.target.id && (
                          <DetailRow label="ID">
                            <span className="font-mono text-[10px]">{event.target.id}</span>
                          </DetailRow>
                        )}
                        {event.target.type && (
                          <DetailRow label={t("common:labels.type")}>
                            <Badge variant="muted">{event.target.type}</Badge>
                          </DetailRow>
                        )}
                      </dl>
                    </section>
                  </>
                )}

                {/* Network / device context */}
                {(event.ip ?? event.location ?? event.device ?? event.browser) && (
                  <>
                    <Separator />
                    <section aria-label={t("timelineDetailsDrawer.requestContext")}>
                      <SectionHeading>{t("timelineDetailsDrawer.requestContext")}</SectionHeading>
                      <dl className="flex flex-col gap-2.5">
                        {event.ip && (
                          <DetailRow label={t("timelineDetailsDrawer.ipAddress")}>
                            <span className="font-mono">{event.ip}</span>
                          </DetailRow>
                        )}
                        {event.location && (
                          <DetailRow label={t("timelineDetailsDrawer.location")}>
                            <span className="flex items-center gap-1">
                              <GlobeIcon
                                className="size-3 text-muted-foreground"
                                aria-hidden="true"
                              />
                              {event.location}
                            </span>
                          </DetailRow>
                        )}
                        {event.device && (
                          <DetailRow label={t("timelineDetailsDrawer.device")}>
                            <span className="flex items-center gap-1">
                              <MonitorIcon
                                className="size-3 text-muted-foreground"
                                aria-hidden="true"
                              />
                              {event.device}
                            </span>
                          </DetailRow>
                        )}
                        {event.browser && (
                          <DetailRow label={t("timelineDetailsDrawer.browser")}>
                            {event.browser}
                          </DetailRow>
                        )}
                      </dl>
                    </section>
                  </>
                )}

                {/* JSON metadata */}
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <>
                    <Separator />
                    <section aria-label={t("timelineDetailsDrawer.eventMetadata")}>
                      <div className="mb-2 flex items-center justify-between">
                        <SectionHeading>{t("timelineDetailsDrawer.metadata")}</SectionHeading>
                        <CopyButton
                          text={JSON.stringify(event.metadata, null, 2)}
                          label={t("timelineDetailsDrawer.copyJsonPayload")}
                        />
                      </div>
                      <JSONTree value={event.metadata} rootLabel="payload" initialOpenDepth={1} />
                    </section>
                  </>
                )}

                <Separator />

                <TimelineQuickActions event={event} userId={userId} />
              </div>
            </ScrollArea>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
