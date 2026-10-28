import { ClockIcon } from "@qeetrix/icons";
import { Avatar, Button, formatNumber, Select } from "@qeetrix/react";
import {
  DataState,
  EmptyState,
  Timeline,
  TimelineGroup,
  TimelineItem,
} from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { ActivityEvent, ActivitySummary } from "@/modules/activity";
import {
  activityRecord,
  byDay,
  DEFAULT_PERIOD,
  dayKey,
  eventTitle,
  KINDS,
  linkApp,
  PERIODS,
  periodDays,
  type TimelineSearch,
  whoDid,
} from "@/modules/timeline/timeline-model";
import { formatIp } from "@/shared/utils/ip-format";
import { iconOf, type Names, titleText, toneOf, whoText } from "./timeline-words";

const ANY = "";

/**
 * The filters (period, kind, result; each kind and the failures with their counts), then the
 * events by day: what happened, linking to its record in Activity, then who, which app, which
 * browser and address, and when. Older events come a page at a time.
 */
export function TimelineEvents({
  userId,
  person,
  filters,
  onFiltersChange,
  summary,
  from,
  events,
  loading,
  error,
  onRetry,
  hasMore,
  loadingMore,
  onMore,
  names,
  now,
}: {
  userId: string;
  person: string;
  filters: TimelineSearch;
  onFiltersChange: (next: TimelineSearch) => void;
  summary?: ActivitySummary;
  from: Date;
  events: ActivityEvent[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  names: Names;
  now: number;
}) {
  const { t } = useTranslation("timeline");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const period = filters.period ?? DEFAULT_PERIOD;
  const days = periodDays(period);
  const narrowed = !!filters.kind || !!filters.result;
  const since = from.toLocaleDateString(locale, { day: "numeric", month: "long" });
  const withCount = (label: string, count?: number) =>
    count === undefined ? label : t("filters.withCount", { label, n: n(count) });
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now).setDate(new Date(now).getDate() - 1));
  const thisYear = new Date(now).getFullYear();
  const dayLabel = (key: string, day: Date) =>
    key === today
      ? t("events.today")
      : key === yesterday
        ? t("events.yesterday")
        : day.toLocaleDateString(locale, {
            weekday: "long",
            day: "numeric",
            month: "long",
            ...(day.getFullYear() === thisYear ? {} : { year: "numeric" }),
          });
  const lookBack = (
    <Link
      to="/users/$userId/timeline"
      params={{ userId }}
      search={{ ...filters, period: "90d" }}
      replace
    >
      {t("events.lookBack")}
    </Link>
  );

  return (
    <>
      <div className="ppl-toolbar">
        <div className="ppl-filters">
          <Select
            aria-label={t("filters.period")}
            className="ppl-filter"
            value={period}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                period: value === DEFAULT_PERIOD ? undefined : (value as TimelineSearch["period"]),
              })
            }
            items={PERIODS.map((value) => ({ value, label: t(`filters.periods.${value}`) }))}
          />
          <Select
            aria-label={t("filters.kind")}
            className="ppl-filter"
            value={filters.kind ?? ANY}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                kind: value ? (value as TimelineSearch["kind"]) : undefined,
              })
            }
            items={[
              { value: ANY, label: t("filters.anyKind") },
              ...KINDS.filter(
                (kind) => !summary || summary.by_category[kind] || filters.kind === kind,
              ).map((kind) => ({
                value: kind,
                label: withCount(t(`filters.kinds.${kind}`), summary?.by_category[kind]),
              })),
            ]}
          />
          <Select
            aria-label={t("filters.result")}
            className="ppl-filter"
            value={filters.result ?? ANY}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, result: value === "failed" ? "failed" : undefined })
            }
            items={[
              { value: ANY, label: t("filters.anyResult") },
              {
                value: "failed",
                label: withCount(t("filters.failed"), summary?.by_outcome.failed),
              },
            ]}
          />
        </div>
      </div>

      <DataState
        loading={loading}
        error={error}
        onRetry={onRetry}
        empty={events.length === 0}
        emptyState={
          narrowed ? (
            <EmptyState
              size="section"
              icon={ClockIcon}
              title={t("events.noMatchTitle")}
              description={t("events.noMatchDescription", { days })}
              actions={
                <Button
                  variant="soft"
                  tone="neutral"
                  onClick={() => onFiltersChange({ period: filters.period })}
                >
                  {t("events.showAll")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              size="section"
              icon={ClockIcon}
              title={t("events.emptyTitle", { days })}
              description={t("events.emptyDescription", { name: person, date: since })}
              actions={
                period === "90d" ? undefined : (
                  <Button
                    variant="soft"
                    tone="neutral"
                    onClick={() => onFiltersChange({ ...filters, period: "90d" })}
                  >
                    {t("events.lookBack")}
                  </Button>
                )
              }
            />
          )
        }
      >
        <Timeline aria-label={t("events.label")}>
          {byDay(events).map((group) => (
            <TimelineGroup key={group.key} label={dayLabel(group.key, group.day)}>
              {group.events.map((e) => (
                <Event key={e.id} event={e} userId={userId} person={person} names={names} />
              ))}
            </TimelineGroup>
          ))}
        </Timeline>
        <div className="tl-more">
          {hasMore ? (
            <Button variant="soft" tone="neutral" loading={loadingMore} onClick={onMore}>
              {t("events.more")}
            </Button>
          ) : (
            <>
              <p>{t("events.end", { date: since })}</p>
              {period === "90d" ? null : lookBack}
            </>
          )}
        </div>
      </DataState>
    </>
  );
}

/** One event: what (its record in Activity), then who, which app, from where, and when. */
function Event({
  event: e,
  userId,
  person,
  names,
}: {
  event: ActivityEvent;
  userId: string;
  person: string;
  names: Names;
}) {
  const { t } = useTranslation("timeline");
  const locale = formatLocale();
  const title = eventTitle(e, userId);
  const who = whoDid(e, userId);
  const app = linkApp(e);
  const name = whoText(who, person, t);
  return (
    <TimelineItem
      title={
        <Link className="tl-event-link" to="/activity" search={activityRecord(e)}>
          {titleText(title, e, t, names)}
        </Link>
      }
      description={
        <span className="tl-by">
          {who.kind === "person" && who.name ? (
            <Avatar name={who.name} size="sm" decorative />
          ) : null}
          <span>{name}</span>
          {app ? <span>· {t(`app.${app}`)}</span> : null}
          {e.browser ? <span>· {e.browser}</span> : null}
          {e.ip ? (
            <span>
              · <code>{formatIp(e.ip)}</code>
            </span>
          ) : null}
        </span>
      }
      time={new Date(e.at).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}
      dateTime={e.at}
      icon={iconOf(title)}
      tone={toneOf(e)}
    />
  );
}
