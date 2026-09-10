import {
  ArrowLeftAlt,
  ArrowRightAlt,
  Clipboard,
  Driver,
  ExportRight,
  Global,
  Monitor,
  ShieldSlash,
  UserRemove,
} from "@qeetrix/icons";
// TimelineDetailsDrawer — extended event details drawer for the identity timeline.
// Extends the activity event-details-drawer concept with:
//   • Correlation / trace ID from event metadata
//   • Related events (link to filtered timeline)
//   • Destructive quick actions (Reset MFA, Disable user, Terminate session)
//     guarded by capability
//   • Prev / next event navigation (mirrors EventDetailsDrawer)
//
// REUSE: imports SeverityBadge from the activity feature (not re-implemented).
// Shares Sheet, ScrollArea, Separator, Button, Badge, Tooltip from @qeetrix/ui.

import {
  Badge,
  Button,
  buttonVariants,
  JSONTree,
  ScrollArea,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  TimeSince,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useCallback } from "react";

import { useCapabilities } from "@/platform/security/capability-provider";
import { ResultBadge } from "@/modules/activity";
import { SeverityBadge } from "@/modules/activity";
import { formatEventTitle } from "@/modules/activity";
import type { ActivityEvent } from "@/modules/activity";
import { useResetUserMfa, useSetUserStatus } from "@/modules/users";

// ---------------------------------------------------------------------------
// Shared sub-components (mirrored from EventDetailsDrawer, not copy-pasted)
// ---------------------------------------------------------------------------

function CopyButton({ text, label }: { text: string; label: string }) {
  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text);
  }, [text]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={handleCopy}
            aria-label={label}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Clipboard className="size-3.5" aria-hidden="true" />
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

// ---------------------------------------------------------------------------
// Changes — before → after diff extracted from event metadata
// ---------------------------------------------------------------------------

interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

function humanizeField(field: string): string {
  return field.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatChangeValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Pull a before → after list out of common audit-metadata shapes:
 *   • metadata.changes = { field: { from, to } | [old, new] }
 *   • metadata.before / metadata.after = { field: value }
 * Returns only fields that actually changed. Empty → the section is hidden.
 */
function extractChanges(metadata: Record<string, unknown> | undefined): FieldChange[] {
  if (!metadata) return [];
  const out: FieldChange[] = [];

  const changes = metadata.changes;
  if (changes && typeof changes === "object" && !Array.isArray(changes)) {
    for (const [field, raw] of Object.entries(changes)) {
      if (Array.isArray(raw) && raw.length >= 2) {
        out.push({ field, before: raw[0], after: raw[1] });
      } else if (raw && typeof raw === "object") {
        const v = raw as Record<string, unknown>;
        const before = v.from ?? v.old ?? v.before ?? v.previous;
        const after = v.to ?? v.new ?? v.after ?? v.current;
        if (before !== undefined || after !== undefined) out.push({ field, before, after });
      }
    }
  }

  const before = metadata.before;
  const after = metadata.after;
  if (before && after && typeof before === "object" && typeof after === "object") {
    const b = before as Record<string, unknown>;
    const a = after as Record<string, unknown>;
    for (const field of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (JSON.stringify(b[field]) !== JSON.stringify(a[field]))
        out.push({ field, before: b[field], after: a[field] });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type TimelineDetailsDrawerProps = {
  /** Currently selected event. Pass null to close the drawer. */
  event: ActivityEvent | null;
  /** The user this timeline belongs to (for quick actions). */
  userId: string;
  /** Event immediately before this one (for prev navigation). */
  prevEvent?: ActivityEvent | null;
  /** Event immediately after this one (for next navigation). */
  nextEvent?: ActivityEvent | null;
  onClose: () => void;
  onSelectPrev?: () => void;
  onSelectNext?: () => void;
};

/**
 * Slide-in Sheet showing the full event payload for the identity timeline.
 * Extends the activity event-details concept with:
 *   - Correlation / trace ID section (from metadata)
 *   - Timeline-scoped quick actions (reset MFA, disable user, terminate session)
 *   - Prev / next event navigation
 *
 * The destructive actions (Reset MFA, Disable user) are guarded by user.write
 * capability. Terminate session is guarded by session management capability.
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
  const access = useCapabilities();
  const canWriteUsers = access.can("user.write");

  const resetMfa = useResetUserMfa();
  const setStatus = useSetUserStatus();

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose],
  );

  const handleDisableUser = useCallback(() => {
    setStatus.mutate({ userId, status: "suspended" });
  }, [setStatus, userId]);

  const handleResetMfa = useCallback(() => {
    resetMfa.mutate(userId);
  }, [resetMfa, userId]);

  // Derive correlation / trace ID from event metadata if present.
  const correlationId =
    typeof event?.metadata?.correlation_id === "string"
      ? event.metadata.correlation_id
      : typeof event?.metadata?.trace_id === "string"
        ? event.metadata.trace_id
        : null;

  // Derive session ID from metadata (if present) for session-level actions.
  const sessionId =
    typeof event?.metadata?.session_id === "string" ? event.metadata.session_id : null;

  // Before → after field changes, when the event carries them.
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
                  aria-label="Previous event"
                  className="size-7"
                >
                  <ArrowLeftAlt className="size-3.5" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={onSelectNext}
                  disabled={!nextEvent || !onSelectNext}
                  aria-label="Next event"
                  className="size-7"
                >
                  <ArrowRightAlt className="size-3.5" aria-hidden="true" />
                </Button>
                <span className="text-[10px] text-muted-foreground">Navigate events</span>
              </div>
            </SheetHeader>

            {/* Scrollable body */}
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-5 p-4">
                {/* Core event fields */}
                <section aria-label="Event details">
                  <dl className="flex flex-col gap-2.5">
                    <DetailRow label="Event ID">
                      <span className="flex items-center gap-1.5">
                        <span className="max-w-48 truncate font-mono text-[10px]">{event.id}</span>
                        <CopyButton text={event.id} label="Copy event ID" />
                      </span>
                    </DetailRow>
                    <DetailRow label="Type">
                      <Badge variant="muted">{event.type}</Badge>
                    </DetailRow>
                    <DetailRow label="Category">
                      <span className="capitalize">{event.category}</span>
                    </DetailRow>
                    <DetailRow label="Result">
                      <ResultBadge event={event} />
                    </DetailRow>
                    <DetailRow label="Severity">
                      <SeverityBadge severity={event.severity} />
                    </DetailRow>
                    <DetailRow label="Timestamp">
                      <time dateTime={event.at}>
                        {new Date(event.at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "long",
                        })}
                      </time>
                    </DetailRow>
                    {event.status && (
                      <DetailRow label="Status">
                        <Badge variant="outline">{event.status}</Badge>
                      </DetailRow>
                    )}
                    {event.source && (
                      <DetailRow label="Source">
                        <span className="flex items-center gap-1">
                          <Driver className="size-3 text-muted-foreground" aria-hidden="true" />
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
                    <section aria-label="Changes">
                      <SectionHeading>Changes</SectionHeading>
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
                    <section aria-label="Correlation and tracing">
                      <SectionHeading>Correlation &amp; tracing</SectionHeading>
                      <dl className="flex flex-col gap-2.5">
                        {event.request_id && (
                          <DetailRow label="Request ID">
                            <span className="flex items-center gap-1.5">
                              <span className="max-w-48 truncate font-mono text-[10px]">
                                {event.request_id}
                              </span>
                              <CopyButton text={event.request_id} label="Copy request ID" />
                            </span>
                          </DetailRow>
                        )}
                        {correlationId && (
                          <DetailRow label="Trace / Corr. ID">
                            <span className="flex items-center gap-1.5">
                              <span className="max-w-48 truncate font-mono text-[10px]">
                                {correlationId}
                              </span>
                              <CopyButton text={correlationId} label="Copy correlation ID" />
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
                    <section aria-label="Actor">
                      <SectionHeading>Actor</SectionHeading>
                      <dl className="flex flex-col gap-2.5">
                        {event.actor.name && <DetailRow label="Name">{event.actor.name}</DetailRow>}
                        {event.actor.id && (
                          <DetailRow label="ID">
                            <span className="flex items-center gap-1.5">
                              <span className="max-w-48 truncate font-mono text-[10px]">
                                {event.actor.id}
                              </span>
                              <CopyButton text={event.actor.id} label="Copy actor ID" />
                            </span>
                          </DetailRow>
                        )}
                        {event.actor.type && (
                          <DetailRow label="Type">
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
                    <section aria-label="Affected resource">
                      <SectionHeading>Affected resource</SectionHeading>
                      <dl className="flex flex-col gap-2.5">
                        {event.target.label && (
                          <DetailRow label="Label">{event.target.label}</DetailRow>
                        )}
                        {event.target.id && (
                          <DetailRow label="ID">
                            <span className="font-mono text-[10px]">{event.target.id}</span>
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

                {/* Network / device context */}
                {(event.ip ?? event.location ?? event.device ?? event.browser) && (
                  <>
                    <Separator />
                    <section aria-label="Request context">
                      <SectionHeading>Request context</SectionHeading>
                      <dl className="flex flex-col gap-2.5">
                        {event.ip && (
                          <DetailRow label="IP address">
                            <span className="font-mono">{event.ip}</span>
                          </DetailRow>
                        )}
                        {event.location && (
                          <DetailRow label="Location">
                            <span className="flex items-center gap-1">
                              <Global className="size-3 text-muted-foreground" aria-hidden="true" />
                              {event.location}
                            </span>
                          </DetailRow>
                        )}
                        {event.device && (
                          <DetailRow label="Device">
                            <span className="flex items-center gap-1">
                              <Monitor
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

                {/* JSON metadata */}
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <>
                    <Separator />
                    <section aria-label="Event metadata">
                      <div className="mb-2 flex items-center justify-between">
                        <SectionHeading>Metadata</SectionHeading>
                        <CopyButton
                          text={JSON.stringify(event.metadata, null, 2)}
                          label="Copy JSON payload"
                        />
                      </div>
                      <JSONTree value={event.metadata} rootLabel="payload" initialOpenDepth={1} />
                    </section>
                  </>
                )}

                <Separator />

                {/* Quick actions — extended over EventDetailsDrawer */}
                <section aria-label="Quick actions">
                  <SectionHeading>Quick actions</SectionHeading>
                  <div className="flex flex-wrap gap-2">
                    {/* Navigation actions */}
                    <Link
                      to="/users/$userId"
                      params={{ userId }}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <ExportRight className="size-3.5" aria-hidden="true" />
                      View user
                    </Link>

                    {sessionId && (
                      <Link
                        to="/security/sessions"
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <ExportRight className="size-3.5" aria-hidden="true" />
                        View session
                      </Link>
                    )}

                    {event.target?.type === "organization" && event.target.id && (
                      <Link
                        to="/organizations/tenants"
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <ExportRight className="size-3.5" aria-hidden="true" />
                        Open org
                      </Link>
                    )}

                    <Link
                      to="/security/audit-logs"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <ExportRight className="size-3.5" aria-hidden="true" />
                      View audit log
                    </Link>

                    {/* Copy actions */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void navigator.clipboard.writeText(event.id)}
                      aria-label="Copy event ID to clipboard"
                    >
                      <Clipboard className="size-3.5" aria-hidden="true" />
                      Copy event ID
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void navigator.clipboard.writeText(JSON.stringify(event, null, 2))
                      }
                      aria-label="Copy full event JSON to clipboard"
                    >
                      <Clipboard className="size-3.5" aria-hidden="true" />
                      Copy JSON
                    </Button>

                    {/* Destructive actions — guarded by user.write capability */}
                    {canWriteUsers && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resetMfa.isPending}
                          onClick={handleResetMfa}
                          aria-label="Reset this user's MFA factors"
                        >
                          <ShieldSlash className="size-3.5" aria-hidden="true" />
                          {resetMfa.isPending ? "Resetting…" : "Reset MFA"}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={setStatus.isPending}
                          onClick={handleDisableUser}
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                          aria-label="Suspend this user account"
                        >
                          <UserRemove className="size-3.5" aria-hidden="true" />
                          {setStatus.isPending ? "Suspending…" : "Disable user"}
                        </Button>
                      </>
                    )}
                  </div>
                </section>
              </div>
            </ScrollArea>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
