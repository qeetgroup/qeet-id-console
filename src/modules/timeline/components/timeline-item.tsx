// TimelineItem — one row of the identity timeline. A dense, columned card:
// category icon + human title + tags on the left, Actor and Location columns in
// the middle, and the outcome badge + timestamp + a ⋮ actions menu on the right.
// The card is a single button (opens the details drawer); the ⋮ menu is a
// sibling so we never nest interactive controls.
//
// REUSE: category icon + severity/result helpers from the activity feature.

import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  TimelineContent,
  TimelineIndicator,
  TimeSince,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TimelineItem as UITimelineItem,
} from "@qeetrix/ui";
import {
  ClipboardIcon,
  FileJsonIcon,
  GlobeIcon,
  MonitorIcon,
  MoreVerticalIcon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { getCategoryIcon } from "@/modules/activity";
import { ResultBadge } from "@/modules/activity";
import { type EventResult, eventResult, formatEventTitle } from "@/modules/activity";
import { formatIp } from "@/modules/activity";
import type { ActivityEvent } from "@/modules/activity";

// ---------------------------------------------------------------------------
// Result → connector node colour + icon-chip tone
// ---------------------------------------------------------------------------

const RESULT_NODE: Record<EventResult, string> = {
  Success: "bg-success ring-success/25",
  Failed: "bg-destructive ring-destructive/25",
  Blocked: "bg-warning ring-warning/25",
  Warning: "bg-warning ring-warning/25",
  Info: "bg-info ring-info/25",
};

/** Icon chips stay neutral except for outcomes that warrant attention. */
function iconTone(result: EventResult): string {
  if (result === "Failed") return "bg-destructive/10 text-destructive ring-destructive/15";
  if (result === "Blocked" || result === "Warning")
    return "bg-warning/10 text-warning ring-warning/15";
  return "bg-muted text-muted-foreground ring-foreground/6";
}

// ---------------------------------------------------------------------------
// Meta column (Actor / Location)
// ---------------------------------------------------------------------------

function MetaColumn({
  label,
  icon: Icon,
  value,
  sub,
}: {
  label: string;
  icon: typeof UserIcon;
  value?: string;
  sub?: string;
}) {
  return (
    <div className="hidden w-36 shrink-0 flex-col justify-center lg:flex xl:w-44">
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
        <Icon className="size-3" aria-hidden="true" />
        {label}
      </span>
      <span className="mt-0.5 truncate text-xs font-medium text-foreground">{value ?? "—"}</span>
      {sub ? <span className="truncate text-[11px] text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row actions menu (⋮)
// ---------------------------------------------------------------------------

function copy(text: string, what: string) {
  void navigator.clipboard.writeText(text);
  toast.success(`Copied ${what}`);
}

function RowActionsMenu({ event, onOpen }: { event: ActivityEvent; onOpen: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Event actions"
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/item:opacity-100 data-popup-open:opacity-100"
          >
            <MoreVerticalIcon className="size-4" aria-hidden="true" />
          </button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onOpen}>View details</DropdownMenuItem>
        <DropdownMenuItem onClick={() => copy(event.id, "event ID")}>
          <ClipboardIcon className="size-3.5" aria-hidden="true" />
          Copy event ID
        </DropdownMenuItem>
        {event.request_id ? (
          <DropdownMenuItem onClick={() => copy(event.request_id ?? "", "request ID")}>
            <ClipboardIcon className="size-3.5" aria-hidden="true" />
            Copy request ID
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => copy(JSON.stringify(event, null, 2), "event JSON")}>
          <FileJsonIcon className="size-3.5" aria-hidden="true" />
          Copy JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// TimelineItem
// ---------------------------------------------------------------------------

type TimelineItemProps = {
  event: ActivityEvent;
  isSelected?: boolean;
  isCurrent?: boolean;
  onClick: (event: ActivityEvent) => void;
  posInSet?: number;
  setSize?: number;
};

export function TimelineItem({
  event,
  isSelected = false,
  isCurrent = false,
  onClick,
  posInSet,
  setSize,
}: TimelineItemProps) {
  const result = eventResult(event);
  const CategoryIcon = getCategoryIcon(event.category);
  const title = formatEventTitle(event);
  const actorName = event.actor?.name ?? event.actor?.id ?? "System";
  const actorSub = event.actor?.type;
  const locationValue = event.location ?? (event.ip ? formatIp(event.ip) : undefined);
  const locationSub = event.device ?? event.browser ?? event.source ?? undefined;

  return (
    <UITimelineItem
      className="group/item relative pb-2"
      aria-current={isCurrent ? "true" : undefined}
      aria-posinset={posInSet}
      aria-setsize={setSize}
    >
      {/* Connector node — coloured by outcome */}
      <TimelineIndicator>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                role="img"
                className={cn(
                  "z-10 mt-3.5 size-2.5 rounded-full ring-4 ring-background transition-transform duration-150 group-hover/item:scale-125",
                  RESULT_NODE[result],
                )}
                aria-label={`Outcome: ${result}`}
              />
            }
          />
          <TooltipContent>{result}</TooltipContent>
        </Tooltip>
      </TimelineIndicator>

      <TimelineContent className="min-w-0 flex-1">
        <div
          className={cn(
            "flex items-stretch gap-1 rounded-lg border border-transparent transition-colors duration-150",
            "hover:border-border/70 hover:bg-muted/40",
            isSelected && "border-ring/40 bg-muted/50 ring-1 ring-ring/25",
          )}
        >
          <button
            type="button"
            onClick={() => onClick(event)}
            aria-label={`${title}, ${result} — open details`}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            {/* Category icon */}
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg ring-1 [&_svg]:size-4",
                iconTone(result),
              )}
              aria-hidden="true"
            >
              <CategoryIcon />
            </span>

            {/* Title + description + tags */}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
              {event.description ? (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {event.description}
                </span>
              ) : null}
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                  {event.category}
                </span>
                {event.source ? (
                  <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {event.source}
                  </span>
                ) : null}
                {/* Compact meta for < lg where the columns are hidden */}
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground lg:hidden">
                  <UserIcon className="size-3" aria-hidden="true" />
                  {actorName}
                  {locationValue ? <span className="text-muted-foreground/50">·</span> : null}
                  {locationValue}
                </span>
              </span>
            </span>

            {/* Actor + Location columns (lg+) */}
            <MetaColumn label="Actor" icon={UserIcon} value={actorName} sub={actorSub} />
            <MetaColumn
              label="Location"
              icon={locationValue ? GlobeIcon : MonitorIcon}
              value={locationValue}
              sub={locationSub}
            />

            {/* Outcome + time */}
            <span className="flex w-24 shrink-0 flex-col items-end gap-1">
              <ResultBadge event={event} />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <time
                      dateTime={event.at}
                      className="text-[11px] text-muted-foreground tabular-nums"
                    >
                      <TimeSince value={event.at} />
                    </time>
                  }
                />
                <TooltipContent>
                  {new Date(event.at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "long",
                  })}
                </TooltipContent>
              </Tooltip>
            </span>
          </button>

          {/* Row actions (sibling of the card button) */}
          <div className="flex items-center pe-1.5">
            <RowActionsMenu event={event} onOpen={() => onClick(event)} />
          </div>
        </div>
      </TimelineContent>
    </UITimelineItem>
  );
}
