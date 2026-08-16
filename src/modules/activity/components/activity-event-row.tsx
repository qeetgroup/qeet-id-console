// A single activity row, styled as a dense two-line data-table row:
//   TIME · ACTOR · ACTION · RESOURCE · OUTCOME · IP ADDRESS
// Each cell stacks a primary value over a muted secondary (relative time, actor
// id, action description, resource id, geo location). The whole row is one
// clickable target (stretched-link) that opens the details drawer; copy buttons
// and the ⋯ Investigate menu sit above the hit area. Columns collapse below `lg`
// into a compact two-line layout.

import { Avatar, AvatarFallback, Badge, cn, TimeSince } from "@qeetrix/ui";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  ServerIcon,
  XCircleIcon,
  XOctagonIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { ActivitySearch } from "../activity-search";
import { formatIp } from "../ip-format";
import type { ActivityEvent, Severity } from "../activity.types";
import { CopyIconButton } from "./copy-icon-button";
import { InvestigateMenu } from "./investigate-menu";
import { SeverityBadge } from "./severity-badge";

// Shared responsive grid template — the header row uses the same tracks so
// columns line up. Mobile collapses to time · action · outcome · ⋯.
const ROW_COLS =
  "grid-cols-[4.25rem_minmax(0,1fr)_auto_1.75rem] " +
  "lg:grid-cols-[6.5rem_minmax(0,1.25fr)_minmax(0,1.55fr)_minmax(0,1.15fr)_6.5rem_minmax(0,1.1fr)_2rem]";

const SEVERITY_ICON: Record<Severity, typeof InfoIcon> = {
  critical: XOctagonIcon,
  error: XCircleIcon,
  warning: AlertTriangleIcon,
  success: CheckCircleIcon,
  info: InfoIcon,
};

const SEVERITY_ICON_CLASS: Record<Severity, string> = {
  critical: "text-danger",
  error: "text-danger",
  warning: "text-warning",
  success: "text-success",
  info: "text-info",
};

function formatTime(at: string): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Middle-truncate a long id like "6607bc8c…f61" / "ses_01J2a…8f7d". */
function shortId(id: string): string {
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-3)}` : id;
}

// Actor avatar tone by actor type (org/user = brand, service/agent = info,
// system = a server glyph, unknown = muted).
function actorVisual(event: ActivityEvent): {
  cls: string;
  content: ReactNode;
  name: string;
} {
  const type = (event.actor?.type ?? "").toLowerCase();
  const name = event.actor?.name ?? event.actor?.id ?? (type ? type : "Unknown");
  if (type.includes("system")) {
    return {
      cls: "bg-muted text-muted-foreground",
      content: <ServerIcon className="size-3.5" />,
      name: event.actor?.name ?? "System",
    };
  }
  const tone =
    type.includes("service") || type.includes("agent")
      ? "bg-info/12 text-info"
      : event.actor?.name || event.actor?.id
        ? "bg-primary/12 text-primary"
        : "bg-muted text-muted-foreground";
  const initials =
    event.actor?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "•";
  return { cls: tone, content: initials, name };
}

/** Column header aligned to the row grid. Decorative; wide viewports only. */
export function ActivityRowHeader() {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "hidden items-center gap-x-3 border-b border-border/60 bg-muted/30 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid lg:px-4",
        ROW_COLS,
      )}
    >
      <span>Time</span>
      <span>Actor</span>
      <span>Action</span>
      <span>Resource</span>
      <span>Outcome</span>
      <span>IP address</span>
      <span className="sr-only">Actions</span>
    </div>
  );
}

type ActivityEventRowProps = {
  event: ActivityEvent;
  isNew?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onFilter?: (patch: Partial<ActivitySearch>) => void;
};

export function ActivityEventRow({
  event,
  isNew = false,
  isSelected = false,
  onSelect,
  onFilter,
}: ActivityEventRowProps) {
  const SevIcon = SEVERITY_ICON[event.severity];
  const isCritical = event.severity === "critical" || event.severity === "error";
  const actor = actorVisual(event);
  const resourceType = event.target?.label ?? event.target?.type;
  const resourceId = event.target?.id;
  const subtitle = event.description ?? event.title;

  return (
    <div
      className={cn(
        "activity-event-row group relative grid items-center gap-x-3 px-3 py-2.5 lg:px-4",
        ROW_COLS,
        isCritical && "bg-danger-subtle/30",
        isNew && "bg-success-subtle/40",
      )}
      data-selected={isSelected}
    >
      {/* TIME */}
      <div className="min-w-0">
        <div
          className="text-xs font-medium tabular-nums text-foreground"
          title={new Date(event.at).toLocaleString()}
        >
          {formatTime(event.at)}
        </div>
        <TimeSince value={event.at} className="text-[11px] tabular-nums text-muted-foreground" />
      </div>

      {/* ACTOR (wide only) */}
      <div className="hidden min-w-0 items-center gap-2 lg:flex">
        <Avatar className="size-7 shrink-0">
          <AvatarFallback className={cn("text-[10px] font-semibold", actor.cls)}>
            {actor.content}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-foreground">{actor.name}</div>
          {event.actor?.id && (
            <div className="flex items-center gap-1">
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {shortId(event.actor.id)}
              </span>
              <CopyIconButton text={event.actor.id} label="Copy actor ID" revealOnHover />
            </div>
          )}
        </div>
      </div>

      {/* ACTION (stretched-link opens the drawer) */}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <SevIcon
            className={cn("size-3.5 shrink-0 lg:hidden", SEVERITY_ICON_CLASS[event.severity])}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={onSelect}
            className="block max-w-full truncate text-left text-sm font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            aria-label={`Open details for ${event.title}`}
          >
            {event.type}
          </button>
          {isNew && (
            <Badge variant="success" className="shrink-0 text-[9px]">
              New
            </Badge>
          )}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
        {/* Mobile-only meta (actor · resource · ip) */}
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground lg:hidden">
          {actor.name}
          {resourceType && <> · {resourceType}</>}
          {event.ip && <> · {formatIp(event.ip)}</>}
        </p>
      </div>

      {/* RESOURCE (wide only) */}
      <div className="hidden min-w-0 lg:block">
        {resourceType ? (
          <>
            <div className="truncate text-xs font-medium capitalize text-foreground">
              {resourceType}
            </div>
            {resourceId && (
              <div className="flex items-center gap-1">
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {shortId(resourceId)}
                </span>
                <CopyIconButton text={resourceId} label="Copy resource ID" revealOnHover />
              </div>
            )}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* OUTCOME */}
      <SeverityBadge severity={event.severity} className="justify-self-start" />

      {/* IP + LOCATION (wide only) */}
      <div className="hidden min-w-0 lg:block">
        <div className="truncate font-mono text-xs text-foreground">{formatIp(event.ip)}</div>
        {event.location && (
          <div className="truncate text-[11px] text-muted-foreground">{event.location}</div>
        )}
      </div>

      {/* Investigate menu — above the stretched hit area */}
      <div className="relative z-1 justify-self-end">
        <InvestigateMenu event={event} onFilter={onFilter} onViewDetails={onSelect} />
      </div>
    </div>
  );
}
