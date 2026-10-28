import { formatNumber } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { Sparkline, SplitBar } from "@/modules/dashboard";
import type { Anomaly, AnomalySummary } from "@/modules/security/api/anomalies";
import {
  ANOMALY_TYPES,
  type AnomalyFilters,
  perDay,
  topSources,
} from "@/modules/security/anomaly-model";

const DAYS = 30;
// The Users band's ordinal ramp (people.css): credential stuffing darkest, spraying a step lighter.
const TYPE_SWATCH = { credential_stuffing: "today", password_spraying: "month" } as const;

/**
 * Anomalies' key numbers, in its header above the tabs: what's open (the server's count), the
 * last 30 days of detections, the two kinds of attack, and the addresses seen most. Each opens
 * the list filtered to it. Everything but "Open" reads the latest 50 the server returns.
 */
export function AnomaliesBand({
  items,
  summary,
  now,
}: {
  items: readonly Anomaly[];
  summary?: AnomalySummary;
  now: number;
}) {
  const { t } = useTranslation("security");
  const n = (value: number) => formatNumber(value, formatLocale());
  const to = (search: AnomalyFilters) => ({ to: "/security/threats/anomalies" as const, search });
  const days = perDay(items, now, DAYS);
  const recent = days.reduce((sum, d) => sum + d, 0);
  const types = ANOMALY_TYPES.map((type) => ({
    type,
    count: items.filter((a) => a.type === type).length,
  }));
  const sources = topSources(items);
  const open = summary?.open ?? 0;

  return (
    <dl className="ppl-band">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("anomalies.band.open")}</dt>
        <dd className="ppl-value">{n(open)}</dd>
        <dd className={summary?.high_severity_24h ? "ppl-note is-warning" : "ppl-note"}>
          {open
            ? t("anomalies.band.highToday", { n: n(summary?.high_severity_24h ?? 0) })
            : t("anomalies.band.nothingOpen")}
        </dd>
        {open ? (
          <dd className="ppl-link">
            <Link {...to({ status: "open" })}>{t("anomalies.band.showOpen")}</Link>
          </dd>
        ) : null}
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("anomalies.band.detected", { days: DAYS })}</dt>
        <dd className="ppl-value">{n(recent)}</dd>
        <dd className="ppl-note">
          {items.length >= 50 ? t("anomalies.band.fromLatest") : t("anomalies.band.perDay")}
        </dd>
        <dd className="ppl-chart">
          <span
            role="img"
            aria-label={t("anomalies.band.chartLabel", { n: n(recent), days: DAYS })}
          >
            <Sparkline values={days} width={132} height={40} />
          </span>
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("anomalies.band.kinds")}</dt>
        <dd className="ppl-recency">
          <SplitBar
            label={types.map((k) => `${t(`anomalies.type.${k.type}`)}: ${n(k.count)}`).join(", ")}
            parts={types.map((k) => ({
              value: k.count,
              color: `var(--ppl-${TYPE_SWATCH[k.type]})`,
            }))}
          />
        </dd>
        <dd className="ppl-recency-legend">
          <ul>
            {types.map((k) => (
              <li key={k.type}>
                <Link {...to({ type: k.type })}>
                  <span className={`ppl-swatch is-${TYPE_SWATCH[k.type]}`} aria-hidden="true" />
                  <b>{n(k.count)}</b> {t(`anomalies.type.${k.type}`).toLowerCase()}
                </Link>
              </li>
            ))}
          </ul>
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("anomalies.band.sources")}</dt>
        <dd className="ppl-looks">
          {sources.length ? (
            <ul>
              {sources.map((s) => (
                <li key={s.ip}>
                  <Link {...to({ q: s.ip })}>
                    <span className="sec-mono">{s.ip}</span>
                    <b>{n(s.count)}</b>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <span className="ppl-note">{t("anomalies.band.noSources")}</span>
          )}
        </dd>
      </div>
    </dl>
  );
}
