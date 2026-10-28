// Analytics (/analytics): the trends report. The Dashboard is the one overview (today, the last 14
// days, what needs attention); this is what it can't show: sign-in over a range you choose, against
// the period before it. Totals in the header, then each day, then the average day of the week.
// Read from the audit log's summary (audit.read); nothing here writes.

import { ChartColumnIcon, ScrollTextIcon } from "@qeetrix/icons";
import { formatDate, formatNumber, Skeleton, Toggle, ToggleGroup } from "@qeetrix/react";
import { DataState, EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type Change,
  changeOf,
  dailyCounts,
  RANGES,
  type RangeKey,
  reportWindow,
  sum,
  weekdayAverages,
} from "@/modules/dashboard/analytics-model";
import { useRangeReport } from "@/modules/dashboard/api/analytics-range";
import { PageBreadcrumb } from "@/modules/dashboard/components/frame/page-place";
import { Group } from "@/modules/dashboard/components/overview/overview-parts";
import { useCapabilities } from "@/platform/security/capability-provider";
import { TrendPanel, trendRows, WeekdayPanel } from "./analytics-charts";
import "./analytics.css";

export type AnalyticsPageProps = {
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
};

export function AnalyticsPage({ range, onRangeChange }: AnalyticsPageProps) {
  const { t } = useTranslation("dashboard");
  const canRead = useCapabilities().can("audit.read");
  // The UTC day: the window moves at midnight UTC, when the server's day buckets do.
  const today = new Date().toISOString().slice(0, 10);
  const period = useMemo(() => reportWindow(range, today), [range, today]);
  const report = useRangeReport(period, canRead);
  const locale = formatLocale();
  const day = (d: string) => formatDate(d, locale);
  const n = (value: number) => formatNumber(value, locale);

  const data = report.data;
  const signIns = dailyCounts(data?.signIns.series, period.dates);
  const previousSignIns = dailyCounts(data?.previousSignIns.series, period.previousDates);
  const failed = dailyCounts(data?.failed.series, period.dates);
  const previousFailed = dailyCounts(data?.previousFailed.series, period.previousDates);
  const total = sum(signIns);
  const before = sum(previousSignIns);
  const people = data?.people.unique_actors ?? 0;
  const peopleBefore = data?.previousPeople.unique_actors ?? 0;
  const failedTotal = sum(failed);
  const failedBefore = sum(previousFailed);
  const perPerson = people ? total / people : 0;
  const perPersonBefore = peopleBefore ? before / peopleBefore : 0;
  const weekdays = weekdayAverages(signIns, period.dates);
  const span = { from: day(period.dates[0] ?? today), to: day(today), days: period.days };

  const change = (c: Change, failures = false) => {
    const text =
      c.kind === "up" || c.kind === "down"
        ? t(`analyticsReport.change.${c.kind}`, { pct: n(c.pct), count: period.days })
        : t(`analyticsReport.change.${c.kind}`, { count: period.days });
    // More failures is the one change worth a second look.
    const warn = failures && (c.kind === "up" || c.kind === "new");
    return <dd className={warn ? "ppl-note is-warning" : "ppl-note"}>{text}</dd>;
  };

  const band = data ? (
    <dl className={report.refreshing ? "ppl-band anl-band is-refreshing" : "ppl-band anl-band"}>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("analyticsReport.band.signIns")}</dt>
        <dd className="ppl-value">{n(total)}</dd>
        {change(changeOf(total, before))}
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("analyticsReport.band.people")}</dt>
        <dd className="ppl-value">{n(people)}</dd>
        {change(changeOf(people, peopleBefore))}
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("analyticsReport.band.failed")}</dt>
        <dd className="ppl-value">{n(failedTotal)}</dd>
        {change(changeOf(failedTotal, failedBefore), true)}
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("analyticsReport.band.perPerson")}</dt>
        <dd className="ppl-value">
          {perPerson.toLocaleString(locale, { maximumFractionDigits: 1 })}
        </dd>
        {change(changeOf(Math.round(perPerson * 10), Math.round(perPersonBefore * 10)))}
      </div>
    </dl>
  ) : canRead && !report.error ? (
    <div className="ppl-band anl-band" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="ppl-cell">
          <Skeleton className="anl-skeleton-label" />
          <Skeleton className="anl-skeleton-value" />
        </div>
      ))}
    </div>
  ) : undefined;

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("analyticsReport.title")}
        description={t("analyticsReport.description", span)}
        actions={
          canRead ? (
            <ToggleGroup
              aria-label={t("analyticsReport.range")}
              value={[range]}
              onValueChange={(v) => v[0] && onRangeChange(v[0] as RangeKey)}
            >
              {RANGES.map((r) => (
                <Toggle key={r} value={r}>
                  {t(`analyticsReport.ranges.${r}`)}
                </Toggle>
              ))}
            </ToggleGroup>
          ) : undefined
        }
        summary={band}
      />
      <PageContent>
        {!canRead ? (
          <EmptyState
            icon={ScrollTextIcon}
            title={t("analyticsReport.noAccessTitle")}
            description={t("analyticsReport.noAccessDescription")}
          />
        ) : (
          <DataState
            loading={report.loading && !data}
            error={data ? null : report.error}
            onRetry={report.retry}
            empty={!!data && total + failedTotal + before + failedBefore === 0}
            emptyState={
              <EmptyState
                icon={ChartColumnIcon}
                title={t("analyticsReport.emptyTitle", { count: period.days })}
                description={t("analyticsReport.emptyDescription")}
              />
            }
          >
            <div className={report.refreshing ? "overview anl is-refreshing" : "overview anl"}>
              <Group columns="minmax(0, 1fr)">
                <TrendPanel
                  title={t("analyticsReport.signIns.title")}
                  note={t("analyticsReport.signIns.note", span)}
                  rows={trendRows(period.dates, signIns, period.previousDates, previousSignIns)}
                  days={period.days}
                />
              </Group>
              <Group columns={weekdays ? "minmax(0, 1.55fr) minmax(0, 1fr)" : "minmax(0, 1fr)"}>
                <TrendPanel
                  title={t("analyticsReport.failed.title")}
                  note={t("analyticsReport.failed.note", span)}
                  rows={trendRows(period.dates, failed, period.previousDates, previousFailed)}
                  days={period.days}
                  failures
                />
                {weekdays ? <WeekdayPanel averages={weekdays} /> : null}
              </Group>
            </div>
          </DataState>
        )}
      </PageContent>
    </>
  );
}
