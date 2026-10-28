import { formatNumber } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { Sparkline, SplitBar } from "@/modules/dashboard";
import type { BotEvent, BotStats } from "@/modules/security/api/bots";
import {
  type BotClient,
  type BotFilters,
  CLIENT_KINDS,
  clientKind,
} from "@/modules/security/bot-model";

// The scorer's fixed line between allowed and challenged (bot.challengeFloor).
export const CHALLENGE_FLOOR = 0.5;
// The Users band's ordinal ramp (people.css): the surest script darkest.
const KIND_SWATCH = { script: "today", none: "month", app: "older" } as const;

/** Bots' key numbers: what would be blocked and challenged in a day, what the clients are, and who tried most. */
export function BotsBand({
  events,
  stats,
  clients,
  now,
}: {
  events: readonly BotEvent[];
  stats: BotStats;
  clients: readonly BotClient[];
  now: number;
}) {
  const { t } = useTranslation("security");
  const n = (value: number) => formatNumber(value, formatLocale());
  const threshold = formatNumber(stats.threshold, formatLocale(), { minimumFractionDigits: 2 });
  const to = (search: BotFilters) => ({ to: "/security/threats/bots" as const, search });
  const kinds = CLIENT_KINDS.map((kind) => ({
    kind,
    count: events.filter((e) => clientKind(e.score) === kind).length,
  }));
  // Would-blocks an hour over the last day, from the last 50 scored sign-ins.
  const hours = Array.from(
    { length: 24 },
    (_, i) =>
      events.filter((e) => {
        const age = Math.floor((now - Date.parse(e.created_at)) / 3_600_000);
        return e.verdict === "blocked" && age === 23 - i;
      }).length,
  );
  const top = [...clients].sort((a, b) => b.count - a.count).slice(0, 3);

  return (
    <dl className="ppl-band">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("bots.band.wouldBlock")}</dt>
        <dd className="ppl-value">{n(stats.blocked_24h)}</dd>
        <dd className="ppl-note">{t("bots.band.wouldBlockNote", { threshold })}</dd>
        <dd className="ppl-chart">
          <span role="img" aria-label={t("bots.band.hoursLabel")}>
            <Sparkline values={hours} width={132} height={40} />
          </span>
          <span className="ppl-chart-caption" aria-hidden="true">
            {t("bots.band.hours")}
          </span>
        </dd>
        {stats.blocked_24h ? (
          <dd className="ppl-link">
            <Link {...to({ verdict: "blocked" })}>{t("bots.band.show")}</Link>
          </dd>
        ) : null}
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("bots.band.wouldChallenge")}</dt>
        <dd className="ppl-value">{n(stats.challenged_24h)}</dd>
        <dd className="ppl-note">
          {t("bots.band.wouldChallengeNote", {
            from: formatNumber(CHALLENGE_FLOOR, formatLocale(), { minimumFractionDigits: 2 }),
            threshold,
          })}
        </dd>
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("bots.band.kinds")}</dt>
        <dd className="ppl-recency">
          <SplitBar
            label={kinds.map((k) => `${t(`bots.kind.${k.kind}`)}: ${n(k.count)}`).join(", ")}
            parts={kinds.map((k) => ({
              value: k.count,
              color: `var(--ppl-${KIND_SWATCH[k.kind]})`,
            }))}
          />
        </dd>
        <dd className="ppl-recency-legend">
          <ul>
            {kinds.map((k) => (
              <li key={k.kind}>
                <span className="sec-legend-item">
                  <span className={`ppl-swatch is-${KIND_SWATCH[k.kind]}`} aria-hidden="true" />
                  <b>{n(k.count)}</b> {t(`bots.kind.${k.kind}`).toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </dd>
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("bots.band.most")}</dt>
        <dd className="ppl-looks">
          {top.length ? (
            <ul>
              {top.map((c) => (
                <li key={c.id}>
                  <Link {...to({ q: c.ip || c.name })}>
                    <span className="sec-clip-line">
                      {c.name || t("bots.noUserAgent")} <span className="sec-mono">{c.ip}</span>
                    </span>
                    <b>{n(c.count)}</b>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <span className="ppl-note">{t("bots.band.none")}</span>
          )}
        </dd>
      </div>
    </dl>
  );
}
