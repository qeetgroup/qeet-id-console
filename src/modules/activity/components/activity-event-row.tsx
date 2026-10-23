import { Avatar, AvatarFallback, Badge, cn, TimeSince } from "@qeetrix/ui";
import { formatLocale } from "@/i18n";
import { initials } from "@/shared/utils/initials";
import {
  CircleCheckBigIcon,
  CircleXIcon,
  type IconProps,
  InfoIcon,
  OctagonXIcon,
  ServerIcon,
  TriangleAlertIcon,
} from "@qeetrix/icons";
import type { ComponentType, ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import type { ActivitySearch } from "../activity-search";
import { formatIp } from "@/shared/utils/ip-format";
import { formatEventTitle } from "../event-labels";
import type { ActivityEvent, Severity } from "../types/activity.types";
import { CopyIconButton } from "./copy-icon-button";
import { InvestigateMenu } from "./investigate-menu";
import { SeverityBadge } from "./severity-badge";

// Shared with the header row so columns line up; below `lg` only time, action, outcome and ⋯
// remain.
const ROW_COLS =
  "grid-cols-[4.25rem_minmax(0,1fr)_auto_1.75rem] " +
  "lg:grid-cols-[6.5rem_minmax(0,1.25fr)_minmax(0,1.55fr)_minmax(0,1.15fr)_6.5rem_minmax(0,1.1fr)_2rem]";

const SEVERITY_ICON: Record<Severity, ComponentType<IconProps<"outline">>> = {
  critical: OctagonXIcon,
  error: CircleXIcon,
  warning: TriangleAlertIcon,
  success: CircleCheckBigIcon,
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
  return new Date(at).toLocaleTimeString(formatLocale(), {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Middle-truncates ids over 16 characters to the first 8 and last 3, e.g. "6607bc8c…f61". */
function shortId(id: string): string {
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-3)}` : id;
}

// A server glyph for system actors, info tone for services and agents, brand tone for any
// other identified actor, muted when unknown.
function actorVisual(
  event: ActivityEvent,
  t: TFunction<["activity", "common"]>,
): {
  cls: string;
  content: ReactNode;
  name: string;
} {
  const type = (event.actor?.type ?? "").toLowerCase();
  const name = event.actor?.name ?? event.actor?.id ?? (type ? type : t("actor.unknown"));
  if (type.includes("system")) {
    return {
      cls: "bg-muted text-muted-foreground",
      content: <ServerIcon className="size-3.5" />,
      name: event.actor?.name ?? t("actor.system"),
    };
  }
  const tone =
    type.includes("service") || type.includes("agent")
      ? "bg-info/12 text-info"
      : event.actor?.name || event.actor?.id
        ? "bg-primary/12 text-primary"
        : "bg-muted text-muted-foreground";
  const content = event.actor?.name ? initials(event.actor.name) : "•";
  return { cls: tone, content, name };
}

/** Renders the column headers on the row grid; decorative, and shown from `lg` up. */
export function ActivityRowHeader() {
  const { t } = useTranslation(["activity", "common"]);
  return (
    <div
      aria-hidden="true"
      className={cn(
        "hidden items-center gap-x-3 border-b border-border/60 bg-muted/30 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid lg:px-4",
        ROW_COLS,
      )}
    >
      <span>{t("activityEventRow.time")}</span>
      <span>{t("activityEventRow.actor")}</span>
      <span>{t("activityEventRow.action")}</span>
      <span>{t("activityEventRow.resource")}</span>
      <span>{t("activityEventRow.outcome")}</span>
      <span>{t("activityEventRow.ipAddress")}</span>
      <span className="sr-only">{t("common:labels.actions")}</span>
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

/**
 * Renders one event as a dense two-line row that collapses below `lg`. The action button's
 * stretched link makes the whole row open the details drawer; copy buttons and the investigate
 * menu sit above that hit area.
 */
export function ActivityEventRow({
  event,
  isNew = false,
  isSelected = false,
  onSelect,
  onFilter,
}: ActivityEventRowProps) {
  const { t } = useTranslation(["activity", "common"]);
  const SevIcon = SEVERITY_ICON[event.severity];
  const isCritical = event.severity === "critical" || event.severity === "error";
  const actor = actorVisual(event, t);
  const resourceType = event.target?.label ?? event.target?.type;
  const resourceId = event.target?.id;
  const subtitle = formatEventTitle(event);

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
          title={new Date(event.at).toLocaleString(formatLocale())}
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
              <CopyIconButton
                text={event.actor.id}
                label={t("activityEventRow.copyActorId")}
                revealOnHover
              />
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
            aria-label={t("activityEventRow.openDetails", { title: subtitle })}
          >
            {event.type}
          </button>
          {isNew && (
            <Badge variant="success" className="shrink-0 text-[9px]">
              {t("activityEventRow.new")}
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
                <CopyIconButton
                  text={resourceId}
                  label={t("activityEventRow.copyResourceId")}
                  revealOnHover
                />
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
