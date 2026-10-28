import { formatNumber } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { Sparkline, SplitBar } from "@/modules/dashboard";
import type { ActivitySearch } from "@/modules/activity/activity-search";
import { bucketWords, fillSeries } from "@/modules/activity/activity-view";
import { categoryLabel } from "@/modules/activity/event-labels";
import type { ActivitySummary } from "@/modules/activity/types/activity.types";

// The Users band's ordinal ramp (people.css), a step apart so neighbours separate: the busiest
// category darkest; past three, the rest share the lightest.
const SWATCH = ["today", "month", "older", "never"] as const;
// Narrow enough to leave room for the range beside it in a 1280px window.
const CHART = { width: 104, height: 40 } as const;

/**
 * The log's key numbers for the range on show, in the header above the tabs: how many events and
 * by how many people, how many failed, which categories they fall in, and what needs a look. They
 * are the server's counts for the same range and search (GET /v1/activity/summary), and each opens
 * the list narrowed to it. `range` names the window ("last 24 hours").
 */
export function ActivityBand({
  summary,
  range,
  clamped,
}: {
  summary: ActivitySummary;
  range: string;
  /** The range runs past the 90 days the counts can cover. */
  clamped: boolean;
}) {
  const { t } = useTranslation("activity");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const narrow = (patch: Partial<ActivitySearch>) => ({
    to: "/activity" as const,
    search: (prev: ActivitySearch) => ({ ...prev, ...patch, view: undefined, event: undefined }),
  });

  const counts = fillSeries(summary, "count");
  const failures = fillSeries(summary, "failed");
  // One scale for both, so the failures read against everything.
  const top = Math.max(1, ...counts);
  const bucket = bucketWords(summary.bucket_seconds);
  const failed = summary.by_outcome.failed ?? 0;
  const share = summary.total ? (failed / summary.total) * 100 : 0;

  const categories = Object.entries(summary.by_category)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const shown = categories.slice(0, 3);
  const others = categories.slice(3).reduce((sum, [, count]) => sum + count, 0);
  const parts = [
    ...shown.map(([id, count], i) => ({ id, count, swatch: SWATCH[i] ?? "never" })),
    ...(others ? [{ id: "", count: others, swatch: "never" as const }] : []),
  ];

  const looks = [
    {
      id: "critical" as const,
      count: summary.by_severity.critical ?? 0,
      search: { severity: "critical", category: undefined },
      danger: true,
    },
    {
      id: "warning" as const,
      count: summary.by_severity.warning ?? 0,
      search: { severity: "warning", category: undefined },
    },
    {
      id: "security" as const,
      count: summary.by_category.security ?? 0,
      search: { category: "security", severity: undefined },
    },
  ];

  return (
    <dl className="ppl-band">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("band.events")}</dt>
        <dd className="ppl-value">{n(summary.total)}</dd>
        <dd className={clamped ? "ppl-note is-warning" : "ppl-note"}>
          {clamped
            ? t("band.clamped")
            : !summary.total
              ? t("band.none")
              : summary.unique_actors
                ? t("band.byPeople", { count: summary.unique_actors, n: n(summary.unique_actors) })
                : t("band.nobody")}
        </dd>
        <dd className="ppl-chart">
          <span
            role="img"
            aria-label={t("band.chartLabel", {
              series: t("band.events"),
              bucket,
              range,
              max: n(top),
            })}
          >
            <Sparkline values={counts} max={top} width={CHART.width} height={CHART.height} />
          </span>
          <span className="ppl-chart-caption" aria-hidden="true">
            {range}
          </span>
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("band.failed")}</dt>
        <dd className="ppl-value">{n(failed)}</dd>
        <dd className="ppl-note">
          {summary.total
            ? t("band.failedShare", {
                pct: formatNumber(share, locale, { maximumFractionDigits: share < 10 ? 1 : 0 }),
              })
            : t("band.none")}
        </dd>
        <dd className="ppl-chart">
          <span
            role="img"
            aria-label={t("band.chartLabel", {
              series: t("band.failed"),
              bucket,
              range,
              max: n(Math.max(0, ...failures)),
            })}
          >
            <Sparkline
              values={failures}
              max={top}
              color="var(--qx-color-dataviz-negative)"
              width={CHART.width}
              height={CHART.height}
            />
          </span>
        </dd>
        {failed ? (
          <dd className="ppl-link">
            <Link {...narrow({ severity: "error,critical" })}>{t("band.failedLink")}</Link>
          </dd>
        ) : null}
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("band.categories")}</dt>
        {parts.length ? null : <dd className="ppl-note">{t("band.none")}</dd>}
        <dd className="ppl-recency">
          <SplitBar
            label={parts
              .map(
                (p) => `${p.id ? categoryLabel(p.id) : t("band.otherCategories")}: ${n(p.count)}`,
              )
              .join(", ")}
            parts={parts.map((p) => ({ value: p.count, color: `var(--ppl-${p.swatch})` }))}
          />
        </dd>
        <dd className="ppl-recency-legend">
          <ul>
            {parts.map((p) => (
              <li key={p.id || "other"}>
                {p.id ? (
                  <Link {...narrow({ category: p.id })}>
                    <span className={`ppl-swatch is-${p.swatch}`} aria-hidden="true" />
                    <b>{n(p.count)}</b> {categoryLabel(p.id).toLowerCase()}
                  </Link>
                ) : (
                  <span className="act-band-rest">
                    <span className={`ppl-swatch is-${p.swatch}`} aria-hidden="true" />
                    <b>{n(p.count)}</b> {t("band.otherCategories")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("band.looks.title")}</dt>
        <dd className="ppl-looks">
          <ul>
            {looks.map((look) => (
              <li key={look.id} className={look.count ? undefined : "is-zero"}>
                <Link {...narrow(look.search)}>
                  <span>{t(`band.looks.${look.id}`)}</span>
                  <b className={look.count && look.danger ? "is-danger" : undefined}>
                    {n(look.count)}
                  </b>
                </Link>
              </li>
            ))}
          </ul>
        </dd>
      </div>
    </dl>
  );
}
