// The latest few events, live: today's first, then earlier ones. The full log is Activity.

import {
  ActivityIcon,
  ArrowRightIcon,
  KeyRoundIcon,
  LogInIcon,
  ShieldAlertIcon,
  UsersIcon,
  WorkflowIcon,
} from "@qeetrix/icons";
import type { QeetrixIcon } from "@qeetrix/react";
import { Button, formatDateTime, formatRelativeTime } from "@qeetrix/react";
import {
  EmptyState,
  Timeline,
  TimelineGroup,
  TimelineItem,
  type TimelineTone,
} from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { type ActivityEvent, formatEventTitle } from "@/modules/activity";
import { useDashboardActivity } from "@/modules/dashboard/use-dashboard-activity";
import { Panel } from "./overview-parts";

const SHOWN = 5;

const CATEGORY_ICON: Record<string, QeetrixIcon> = {
  authentication: LogInIcon,
  authorization: KeyRoundIcon,
  security: ShieldAlertIcon,
  directory: UsersIcon,
  developer: WorkflowIcon,
};

function toneOf(event: ActivityEvent): TimelineTone {
  if (event.severity === "critical" || event.severity === "error") return "danger";
  if (event.severity === "warning") return "warning";
  if (event.severity === "success") return "success";
  return "neutral";
}

function isToday(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function Item({ event, now }: { event: ActivityEvent; now: Date }) {
  const at = new Date(event.at);
  const locale = formatLocale();
  return (
    <TimelineItem
      icon={CATEGORY_ICON[event.category] ?? ActivityIcon}
      tone={toneOf(event)}
      title={formatEventTitle(event)}
      description={event.actor?.name ?? event.target?.label}
      dateTime={at.toISOString()}
      time={<span title={formatDateTime(at, locale)}>{formatRelativeTime(at, locale, now)}</span>}
    />
  );
}

export function RecentActivityPanel() {
  const { t } = useTranslation("dashboard");
  const { events, connecting } = useDashboardActivity();
  const now = new Date();
  const shown = events.slice(0, SHOWN);
  const today = shown.filter((e) => isToday(e.at, now));
  const earlier = shown.filter((e) => !isToday(e.at, now));
  return (
    <Panel
      title={t("overview.activity.title")}
      action={
        <Button variant="ghost" size="sm" icon={ArrowRightIcon} render={<Link to="/activity" />}>
          {t("overview.activity.action")}
        </Button>
      }
    >
      {connecting ? (
        <p className="overview-empty">{t("overview.activity.loading")}</p>
      ) : shown.length ? (
        <Timeline>
          {today.length ? (
            <TimelineGroup label={t("overview.activity.today")}>
              {today.map((e) => (
                <Item key={e.id} event={e} now={now} />
              ))}
            </TimelineGroup>
          ) : null}
          {earlier.length ? (
            <TimelineGroup label={t("overview.activity.earlier")}>
              {earlier.map((e) => (
                <Item key={e.id} event={e} now={now} />
              ))}
            </TimelineGroup>
          ) : null}
        </Timeline>
      ) : (
        <EmptyState
          size="section"
          icon={ActivityIcon}
          title={t("overview.activity.emptyTitle")}
          description={t("overview.activity.emptyText")}
        />
      )}
    </Panel>
  );
}
