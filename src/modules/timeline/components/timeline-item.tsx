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
  EllipsisVerticalIcon,
  FileBracesIcon,
  GlobeIcon,
  type IconProps,
  MonitorIcon,
  UserIcon,
} from "@qeetrix/icons";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import i18n, { formatLocale, type TranslationKey } from "@/i18n";
import { getCategoryIcon } from "@/modules/activity";
import { ResultBadge } from "@/modules/activity";
import {
  actorTypeLabel,
  categoryLabel,
  type EventResult,
  eventResult,
  formatEventTitle,
} from "@/modules/activity";
import { formatIp } from "@/shared/utils/ip-format";
import type { ActivityEvent } from "@/modules/activity";

const RESULT_NODE: Record<EventResult, string> = {
  success: "bg-success ring-success/25",
  failed: "bg-destructive ring-destructive/25",
  blocked: "bg-warning ring-warning/25",
  warning: "bg-warning ring-warning/25",
  info: "bg-info ring-info/25",
};

// Icon chips stay neutral except for outcomes that need attention.
function iconTone(result: EventResult): string {
  if (result === "failed") return "bg-destructive/10 text-destructive ring-destructive/15";
  if (result === "blocked" || result === "warning")
    return "bg-warning/10 text-warning ring-warning/15";
  return "bg-muted text-muted-foreground ring-foreground/6";
}

function MetaColumn({
  label,
  icon: Icon,
  value,
  sub,
}: {
  label: string;
  icon: ComponentType<IconProps<"outline">>;
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

// `copiedKey` names what was copied, for the toast.
function copy(text: string, copiedKey: TranslationKey) {
  void navigator.clipboard.writeText(text);
  toast.success(i18n.t(copiedKey));
}

function RowActionsMenu({ event, onOpen }: { event: ActivityEvent; onOpen: () => void }) {
  const { t } = useTranslation("timeline");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={t("timelineItem.eventActions")}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/item:opacity-100 data-popup-open:opacity-100"
          >
            <EllipsisVerticalIcon className="size-4" aria-hidden="true" />
          </button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onOpen}>{t("timelineItem.viewDetails")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => copy(event.id, "timeline:timelineItem.copiedEventId")}>
          <ClipboardIcon className="size-3.5" aria-hidden="true" />
          {t("timelineItem.copyEventId")}
        </DropdownMenuItem>
        {event.request_id ? (
          <DropdownMenuItem
            onClick={() => copy(event.request_id ?? "", "timeline:timelineItem.copiedRequestId")}
          >
            <ClipboardIcon className="size-3.5" aria-hidden="true" />
            {t("timelineItem.copyRequestId")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onClick={() => copy(JSON.stringify(event, null, 2), "timeline:timelineItem.copiedJson")}
        >
          <FileBracesIcon className="size-3.5" aria-hidden="true" />
          {t("timelineItem.copyJson")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type TimelineItemProps = {
  event: ActivityEvent;
  isSelected?: boolean;
  isCurrent?: boolean;
  onClick: (event: ActivityEvent) => void;
  posInSet?: number;
  setSize?: number;
};

/**
 * Renders one timeline row: a card button that opens the details drawer, with the outcome as
 * the connector node's colour. The ⋮ menu is a sibling of the button so interactive controls
 * never nest.
 */
export function TimelineItem({
  event,
  isSelected = false,
  isCurrent = false,
  onClick,
  posInSet,
  setSize,
}: TimelineItemProps) {
  const { t } = useTranslation(["timeline", "activity"]);
  const result = eventResult(event);
  const resultLabel = t(`activity:result.${result}`);
  const CategoryIcon = getCategoryIcon(event.category);
  const title = formatEventTitle(event);
  const actorName = event.actor?.name ?? event.actor?.id ?? t("timelineItem.system");
  const actorSub = event.actor?.type ? actorTypeLabel(event.actor.type) : undefined;
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
                aria-label={t("timelineItem.outcome", { result: resultLabel })}
              />
            }
          />
          <TooltipContent>{resultLabel}</TooltipContent>
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
            aria-label={t("timelineItem.openDetails", { title, result: resultLabel })}
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
                <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {categoryLabel(event.category)}
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
            <MetaColumn
              label={t("timelineItem.actor")}
              icon={UserIcon}
              value={actorName}
              sub={actorSub}
            />
            <MetaColumn
              label={t("timelineItem.location")}
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
                  {new Date(event.at).toLocaleString(formatLocale(), {
                    dateStyle: "medium",
                    timeStyle: "long",
                  })}
                </TooltipContent>
              </Tooltip>
            </span>
          </button>

          {/* A sibling of the card button, so interactive controls don't nest */}
          <div className="flex items-center pe-1.5">
            <RowActionsMenu event={event} onOpen={() => onClick(event)} />
          </div>
        </div>
      </TimelineContent>
    </UITimelineItem>
  );
}
