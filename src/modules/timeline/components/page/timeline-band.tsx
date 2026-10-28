import { formatNumber, Skeleton } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { ActivitySummary } from "@/modules/activity";
import { SIGN_IN_CAP } from "@/modules/timeline/api/timeline";
import {
  type DayCount,
  type SignInSummary,
  type TimelineSearch,
  periodDays,
  DEFAULT_PERIOD,
} from "@/modules/timeline/timeline-model";
import { formatIp } from "@/shared/utils/ip-format";

const longDay = (d: Date, locale: string) =>
  d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
const shortDay = (d: Date, locale: string) =>
  d.toLocaleDateString(locale, { day: "numeric", month: "short" });

/**
 * The period summed up, in the header: how many events and on how many days (with a bar a day,
 * failures on top), the sign-ins and how they were made, what failed, and where from. "Show the
 * failures" narrows the list below to them.
 */
export function TimelineBand({
  userId,
  filters,
  summary,
  days,
  signIns,
  capped,
}: {
  userId: string;
  filters: TimelineSearch;
  summary: ActivitySummary;
  days: DayCount[];
  signIns: SignInSummary;
  capped: boolean;
}) {
  const { t } = useTranslation("timeline");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const period = filters.period ?? DEFAULT_PERIOD;
  const length = periodDays(period);
  const active = days.filter((d) => d.count > 0).length;
  const failed = summary.by_outcome.failed ?? 0;
  const otherFailed = failed - signIns.failed;
  const [topIp, nextIp] = signIns.addresses;
  const list = new Intl.ListFormat(locale, { type: "conjunction" });

  return (
    <dl className="ppl-band tl-band">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("band.events")}</dt>
        <dd className="ppl-value">{n(summary.total)}</dd>
        <dd className="ppl-note">
          {active
            ? t("band.eventsNote", { n: n(active), days: length })
            : t("band.noEvents", { days: length })}
        </dd>
        <dd className="tl-days">
          <DayBars days={days} />
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("band.signIns")}</dt>
        <dd className="ppl-value">{n(signIns.signIns)}</dd>
        {signIns.signIns ? (
          <>
            <dd className="ppl-note">
              {t("band.twoStep", { n: n(signIns.twoStep), total: n(signIns.signIns) })}
            </dd>
            {signIns.top ? (
              <dd className="ppl-note">
                {t("band.mostly", { method: t(`method.${signIns.top.method}`) })}
              </dd>
            ) : null}
          </>
        ) : (
          <dd className="ppl-note">{t("band.noSignIns", { days: length })}</dd>
        )}
        {signIns.moves ? (
          <dd className="ppl-note">
            {t("band.moves", { count: signIns.moves, n: n(signIns.moves) })}
          </dd>
        ) : null}
        {capped ? <dd className="ppl-note">{t("band.capped", { n: n(SIGN_IN_CAP) })}</dd> : null}
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("band.failed")}</dt>
        <dd className="ppl-value">{n(failed)}</dd>
        <dd className={failed ? "ppl-note is-warning" : "ppl-note"}>
          {failed
            ? [
                ...signIns.failures.map((f) =>
                  t(`failure.${f.reason}`, { count: f.count, n: n(f.count) }),
                ),
                ...(otherFailed > 0 ? [t("band.otherFailed", { n: n(otherFailed) })] : []),
              ].join(" · ")
            : t("band.nothingFailed")}
        </dd>
        {failed && filters.result !== "failed" ? (
          <dd className="ppl-link">
            <Link
              to="/users/$userId/timeline"
              params={{ userId }}
              search={{ ...filters, result: "failed" }}
              replace
            >
              {t("band.showFailed")}
            </Link>
          </dd>
        ) : null}
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("band.addresses")}</dt>
        <dd className="ppl-value">{n(signIns.addresses.length)}</dd>
        {signIns.addresses.length === 0 ? (
          <dd className="ppl-note">{t("band.noAddresses")}</dd>
        ) : signIns.browsers.length ? (
          <dd className="ppl-note">
            {t("band.browsers", { browsers: list.format(signIns.browsers) })}
          </dd>
        ) : null}
        {topIp && topIp.count > (nextIp?.count ?? 0) && nextIp ? (
          <dd className="ppl-note">
            {t("band.mostFrom", { ip: formatIp(topIp.ip), n: n(topIp.count) })}
          </dd>
        ) : null}
      </div>
    </dl>
  );
}

/** A bar a day, its height the day's events against the busiest day, its failed part on top. */
function DayBars({ days }: { days: DayCount[] }) {
  const { t } = useTranslation("timeline");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const top = Math.max(1, ...days.map((d) => d.count));
  const busiest = days.reduce<DayCount | undefined>(
    (best, d) => (d.count > (best?.count ?? 0) ? d : best),
    undefined,
  );
  const failedDays = days.filter((d) => d.failed > 0).length;
  const first = days[0]?.day ?? new Date();
  const label = [
    busiest
      ? t("band.byDay", {
          from: longDay(first, locale),
          busiest: longDay(busiest.day, locale),
          n: n(busiest.count),
        })
      : t("band.byDayNone", { from: longDay(first, locale) }),
    failedDays ? t("band.byDayFailed", { count: failedDays, n: n(failedDays) }) : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className="tl-days-chart" role="img" aria-label={label}>
      <span className="tl-days-bars">
        {days.map((d) => (
          <span
            key={d.day.getTime()}
            className={d.count ? "tl-day" : "tl-day is-empty"}
            style={
              {
                "--tl-h": `${(d.count / top) * 100}%`,
                "--tl-f": `${(d.failed / Math.max(d.count, 1)) * 100}%`,
              } as CSSProperties
            }
          >
            {d.failed ? <span className="tl-day-failed" /> : null}
          </span>
        ))}
      </span>
      <span className="tl-days-axis" aria-hidden="true">
        <span>{shortDay(first, locale)}</span>
        <span>{t("band.today")}</span>
      </span>
    </span>
  );
}

/** The band's place while its numbers load, so the header doesn't jump when they arrive. */
export function TimelineBandPlaceholder() {
  return (
    <div className="ppl-band tl-band" aria-hidden="true">
      {[0, 1, 2, 3].map((cell) => (
        <div key={cell} className="ppl-cell">
          <Skeleton className="ppl-skeleton-label" />
          <Skeleton className="ppl-skeleton-value" />
          <Skeleton lines={2} />
        </div>
      ))}
    </div>
  );
}
