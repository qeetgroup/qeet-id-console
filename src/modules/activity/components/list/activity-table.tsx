import {
  CopyIcon,
  ExternalLinkIcon,
  FunnelIcon,
  PanelRightOpenIcon,
  ServerIcon,
} from "@qeetrix/icons";
import {
  Avatar,
  Badge,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  MenuItem,
  MenuSeparator,
  type TableColumn,
  Text,
} from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import type { ActivitySearch } from "@/modules/activity/activity-search";
import { eventActor } from "@/modules/activity/activity-view";
import { formatEventTitle, resourceLabel } from "@/modules/activity/event-labels";
import type { ActivityEvent } from "@/modules/activity/types/activity.types";
import { SeverityBadge } from "../severity-badge";

const DAY = 86_400_000;
// The library's default time zone, so the clock under a date agrees with it.
const ZONE = "Asia/Kolkata";

/** "2 minutes ago", or the date once it's more than 30 days back. */
export function whenText(at: string, now: number, locale: string): string {
  const ms = Math.min(Date.parse(at), now);
  return now - ms > 30 * DAY
    ? formatDate(ms, locale, { dateStyle: "medium" })
    : formatRelativeTime(ms, locale, now);
}

/**
 * The list's columns, in the order Security › Audit logs uses, one fact each: the event (its
 * words over its action), who did it, what it acted on, where from, its outcome, and when.
 */
export function useActivityColumns({
  newIds,
  now,
}: {
  newIds: ReadonlySet<string>;
  now: number;
}): TableColumn<ActivityEvent>[] {
  const { t } = useTranslation("activity");
  const locale = formatLocale();
  const clock = new Intl.DateTimeFormat(locale, { timeStyle: "medium", timeZone: ZONE });
  return [
    {
      id: "event",
      header: t("table.columns.event"),
      primary: true,
      cell: (e) => (
        <span className="act-two">
          <span className="act-title">
            <span>{formatEventTitle(e)}</span>
            {newIds.has(e.id) ? (
              <Badge tone="brand" size="sm">
                {t("table.new")}
              </Badge>
            ) : null}
          </span>
          <small className="act-mono">{e.type}</small>
        </span>
      ),
    },
    {
      id: "actor",
      header: t("table.columns.actor"),
      cell: (e) => {
        const actor = eventActor(e);
        return (
          <span className="act-who">
            {actor.system || !actor.personName ? (
              <span className="act-system" aria-hidden="true">
                <ServerIcon />
              </span>
            ) : (
              <Avatar name={actor.name} size="sm" decorative />
            )}
            <span className="act-two">
              <span className="act-clip">{actor.name}</span>
              {actor.note ? <small className="act-clip">{actor.note}</small> : null}
            </span>
          </span>
        );
      },
    },
    {
      id: "resource",
      header: t("table.columns.resource"),
      width: 150,
      cell: (e) =>
        e.target?.type ? (
          <span className="act-two">
            <span className="act-clip">{e.target.label ?? resourceLabel(e.target.type)}</span>
            {e.target.id ? <small className="act-mono">{e.target.id.slice(0, 8)}</small> : null}
          </span>
        ) : (
          <Text tone="subtle">—</Text>
        ),
    },
    {
      id: "address",
      header: t("table.columns.address"),
      width: 150,
      cell: (e) =>
        e.ip ? (
          <span className="act-two">
            <span className="act-mono act-clip">{e.ip}</span>
            {e.browser ? <small>{e.browser}</small> : null}
          </span>
        ) : (
          <Text tone="subtle">{t("table.noAddress")}</Text>
        ),
    },
    {
      id: "outcome",
      header: t("table.columns.outcome"),
      width: 104,
      cell: (e) => <SeverityBadge severity={e.severity} />,
    },
    {
      id: "when",
      header: t("table.columns.when"),
      numeric: true,
      width: 140,
      cell: (e) => (
        <span className="act-two act-end">
          <time dateTime={e.at} title={formatDateTime(e.at, locale, { timeStyle: "medium" })}>
            {whenText(e.at, now, locale)}
          </time>
          <small>{clock.format(new Date(e.at))}</small>
        </span>
      ),
    },
  ];
}

/** A row's menu: open it, narrow the list to what it shares, open its actor, copy its ID. */
export function ActivityRowActions({
  event,
  onOpen,
  onFilter,
}: {
  event: ActivityEvent;
  onOpen: () => void;
  onFilter: (patch: Partial<ActivitySearch>) => void;
}) {
  const { t } = useTranslation("activity");
  const actor = eventActor(event);
  const title = formatEventTitle(event);
  const person = actor.personId ? (actor.personName ?? actor.name) : undefined;
  return (
    <>
      <MenuItem icon={PanelRightOpenIcon} onClick={onOpen}>
        {t("table.actions.view")}
      </MenuItem>
      <MenuSeparator />
      {actor.personId && person ? (
        <MenuItem icon={FunnelIcon} onClick={() => onFilter({ actor: actor.personId })}>
          {t("table.actions.onlyActor", { name: person })}
        </MenuItem>
      ) : null}
      {event.ip ? (
        <MenuItem icon={FunnelIcon} onClick={() => onFilter({ ip: event.ip })}>
          {t("table.actions.onlyIp", { ip: event.ip })}
        </MenuItem>
      ) : null}
      <MenuItem icon={FunnelIcon} onClick={() => onFilter({ type: event.type })}>
        {t("table.actions.onlyType", { title })}
      </MenuItem>
      <MenuSeparator />
      {actor.personId && person ? (
        <MenuItem
          icon={ExternalLinkIcon}
          render={<Link to="/users/$userId" params={{ userId: actor.personId }} />}
        >
          {t("table.actions.openActor", { name: person })}
        </MenuItem>
      ) : null}
      <MenuItem
        icon={CopyIcon}
        onClick={() => {
          void navigator.clipboard.writeText(event.id);
          toast.success(t("table.actions.copied"));
        }}
      >
        {t("table.actions.copyId")}
      </MenuItem>
    </>
  );
}
