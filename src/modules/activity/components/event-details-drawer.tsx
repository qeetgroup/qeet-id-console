// Event details drawer — a right-side Sheet that turns a selected event into an
// investigation surface: an Overview tab (human context first, IDs second, all
// copyable), a Raw event tab (full JSON), and a Related events tab (correlated
// by request_id / same actor). The header carries an Investigate menu and
// prev/next navigation within the loaded feed.

import {
  Badge,
  Button,
  buttonVariants,
  CopyButton,
  JSONTree,
  ScrollArea,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TimeSince,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useCopyToClipboard,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardIcon,
  ExternalLinkIcon,
  GlobeIcon,
  MonitorIcon,
  SearchIcon,
  ServerIcon,
} from "lucide-react";
import { type ReactNode, useCallback } from "react";

import type { ActivitySearch, DrawerTab } from "../activity-search";
import { formatIp } from "../ip-format";
import type { ActivityEvent } from "../types/activity.types";
import { InvestigateMenu } from "./investigate-menu";
import { RelatedEventsList } from "./related-events-list";
import { SeverityBadge } from "./severity-badge";

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

/** Icon-only copy control built on the shared useCopyToClipboard hook. */
function CopyIconButton({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => copy(text)}
            aria-label={label}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied ? (
              <CheckIcon className="size-3.5 text-success" aria-hidden="true" />
            ) : (
              <ClipboardIcon className="size-3.5" aria-hidden="true" />
            )}
          </button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-xs text-foreground">{children}</dd>
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function MonoId({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="max-w-48 truncate font-mono text-[10px]">{value}</span>
      <CopyIconButton text={value} label={label} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main drawer
// ---------------------------------------------------------------------------

type EventDetailsDrawerProps = {
  event: ActivityEvent | null;
  prevEvent?: ActivityEvent | null;
  nextEvent?: ActivityEvent | null;
  activeTab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
  onSelectPrev?: () => void;
  onSelectNext?: () => void;
  /** Select a related event (swaps the drawer to it). */
  onSelectEvent?: (event: ActivityEvent) => void;
  /** Apply a filter patch from the Investigate menu. */
  onFilter?: (patch: Partial<ActivitySearch>) => void;
};

export function EventDetailsDrawer({
  event,
  prevEvent,
  nextEvent,
  activeTab,
  onTabChange,
  onClose,
  onSelectPrev,
  onSelectNext,
  onSelectEvent,
  onFilter,
}: EventDetailsDrawerProps) {
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose],
  );

  return (
    <Sheet open={!!event} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        {event ? (
          <>
            {/* Header */}
            <SheetHeader className="border-b border-border/60 p-4">
              <div className="flex items-start gap-3 pr-8">
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-sm">{event.title}</SheetTitle>
                  <SheetDescription className="mt-0.5 text-xs">
                    {event.category} ·{" "}
                    <TimeSince value={event.at} className="inline tabular-nums" />
                  </SheetDescription>
                </div>
                <SeverityBadge severity={event.severity} />
              </div>

              {/* who → action → resource */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="max-w-40 truncate font-medium text-foreground">
                  {event.actor?.name ?? event.actor?.id ?? event.actor?.type ?? "System"}
                </span>
                <ArrowRightIcon className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{event.title}</span>
                {event.target && (
                  <>
                    <ArrowRightIcon className="size-3 shrink-0" aria-hidden="true" />
                    <span className="max-w-40 truncate font-medium text-foreground">
                      {event.target.label ?? event.target.id ?? event.target.type}
                    </span>
                  </>
                )}
              </div>

              {/* Actions + prev/next */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <InvestigateMenu
                  event={event}
                  onFilter={onFilter}
                  align="start"
                  trigger={
                    <Button variant="outline" size="sm">
                      <SearchIcon className="size-3.5" aria-hidden="true" />
                      Investigate
                    </Button>
                  }
                />
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={onSelectPrev}
                    disabled={!prevEvent || !onSelectPrev}
                    aria-label="Previous event"
                    className="size-7"
                  >
                    <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={onSelectNext}
                    disabled={!nextEvent || !onSelectNext}
                    aria-label="Next event"
                    className="size-7"
                  >
                    <ChevronRightIcon className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => onTabChange(v as DrawerTab)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList className="mx-4 mt-3 w-[calc(100%-2rem)] justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="raw">Raw event</TabsTrigger>
                <TabsTrigger value="related">Related</TabsTrigger>
              </TabsList>

              <ScrollArea className="min-h-0 flex-1">
                {/* Overview */}
                <TabsContent value="overview" className="flex flex-col gap-5 p-4">
                  <section aria-label="Event details">
                    <dl className="flex flex-col gap-2.5">
                      <DetailRow label="Event ID">
                        <MonoId value={event.id} label="Copy event ID" />
                      </DetailRow>
                      <DetailRow label="Type">
                        <Badge variant="muted">{event.type}</Badge>
                      </DetailRow>
                      <DetailRow label="Category">{event.category}</DetailRow>
                      <DetailRow label="Timestamp">
                        <time dateTime={event.at}>
                          {new Date(event.at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "long",
                          })}
                        </time>
                      </DetailRow>
                      {event.request_id && (
                        <DetailRow label="Request ID">
                          <MonoId value={event.request_id} label="Copy request ID" />
                        </DetailRow>
                      )}
                      {event.status && (
                        <DetailRow label="Status">
                          <Badge variant="outline">{event.status}</Badge>
                        </DetailRow>
                      )}
                      {event.source && (
                        <DetailRow label="Source">
                          <span className="flex items-center gap-1">
                            <ServerIcon
                              className="size-3 text-muted-foreground"
                              aria-hidden="true"
                            />
                            {event.source}
                          </span>
                        </DetailRow>
                      )}
                    </dl>
                  </section>

                  {event.actor && (
                    <>
                      <Separator />
                      <section aria-label="Actor">
                        <SectionHeading>Actor</SectionHeading>
                        <dl className="flex flex-col gap-2.5">
                          {event.actor.name && (
                            <DetailRow label="Name">{event.actor.name}</DetailRow>
                          )}
                          {event.actor.id && (
                            <DetailRow label="ID">
                              <MonoId value={event.actor.id} label="Copy actor ID" />
                            </DetailRow>
                          )}
                          {event.actor.type && (
                            <DetailRow label="Type">
                              <Badge variant="muted">{event.actor.type}</Badge>
                            </DetailRow>
                          )}
                          {event.actor.id && (
                            <DetailRow label="Links">
                              <span className="flex flex-wrap gap-2">
                                <Link
                                  to="/users/$userId"
                                  params={{ userId: event.actor.id }}
                                  className={buttonVariants({ variant: "outline", size: "sm" })}
                                >
                                  <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
                                  View user
                                </Link>
                                <Link
                                  to="/users/$userId/timeline"
                                  params={{ userId: event.actor.id }}
                                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                                >
                                  Timeline
                                </Link>
                              </span>
                            </DetailRow>
                          )}
                        </dl>
                      </section>
                    </>
                  )}

                  {event.target && (
                    <>
                      <Separator />
                      <section aria-label="Affected resource">
                        <SectionHeading>Affected resource</SectionHeading>
                        <dl className="flex flex-col gap-2.5">
                          {event.target.label && (
                            <DetailRow label="Label">{event.target.label}</DetailRow>
                          )}
                          {event.target.id && (
                            <DetailRow label="ID">
                              <MonoId value={event.target.id} label="Copy resource ID" />
                            </DetailRow>
                          )}
                          {event.target.type && (
                            <DetailRow label="Type">
                              <Badge variant="muted">{event.target.type}</Badge>
                            </DetailRow>
                          )}
                        </dl>
                      </section>
                    </>
                  )}

                  {(event.ip ?? event.location ?? event.device ?? event.browser) && (
                    <>
                      <Separator />
                      <section aria-label="Request context">
                        <SectionHeading>Request context</SectionHeading>
                        <dl className="flex flex-col gap-2.5">
                          {event.ip && (
                            <DetailRow label="IP address">
                              <span className="flex items-center gap-1.5">
                                <span className="font-mono text-[11px]">{formatIp(event.ip)}</span>
                                <CopyIconButton text={event.ip} label="Copy IP address" />
                              </span>
                            </DetailRow>
                          )}
                          {event.location && (
                            <DetailRow label="Location">
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
                            <DetailRow label="Device">
                              <span className="flex items-center gap-1">
                                <MonitorIcon
                                  className="size-3 text-muted-foreground"
                                  aria-hidden="true"
                                />
                                {event.device}
                              </span>
                            </DetailRow>
                          )}
                          {event.browser && <DetailRow label="Browser">{event.browser}</DetailRow>}
                        </dl>
                      </section>
                    </>
                  )}

                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <>
                      <Separator />
                      <section aria-label="Event metadata">
                        <SectionHeading>Metadata</SectionHeading>
                        <JSONTree value={event.metadata} rootLabel="payload" initialOpenDepth={1} />
                      </section>
                    </>
                  )}
                </TabsContent>

                {/* Raw event */}
                <TabsContent value="raw" className="flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <SectionHeading>Raw event</SectionHeading>
                    <CopyButton
                      value={JSON.stringify(event, null, 2)}
                      variant="outline"
                      size="sm"
                      label="Copy JSON"
                      copiedLabel="Copied"
                    />
                  </div>
                  <JSONTree value={event} rootLabel="event" initialOpenDepth={2} />
                </TabsContent>

                {/* Related events */}
                <TabsContent value="related" className="p-4">
                  <RelatedEventsList eventId={event.id} onSelect={onSelectEvent} />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
