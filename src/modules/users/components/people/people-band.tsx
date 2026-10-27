import { formatNumber, Meter } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { Sparkline, SplitBar } from "@/modules/dashboard";
import type { User, UserStats } from "@/modules/users/api/users";
import {
  growth,
  LOOKS,
  needsLook,
  type PeopleFilters,
  RECENCY,
  recency,
  TWO_STEP_TARGET,
} from "@/modules/users/people-model";

const GROWTH_MONTHS = 15;

/**
 * The list's key numbers, in its header above the tabs: people over time, two-step coverage
 * against its target, when people were last active, and what needs a look. Each part opens the
 * list filtered to it.
 */
export function PeopleBand({
  stats,
  users,
  now,
}: {
  stats: UserStats;
  users: User[];
  now: number;
}) {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const total = stats.total || users.length;
  const share = total ? Math.round((stats.mfa_enabled / total) * 100) : 0;
  const months = growth(users, now, GROWTH_MONTHS);
  const seen = RECENCY.map((id) => ({
    id,
    count: users.filter((u) => recency(u, now) === id).length,
  }));
  const to = (search: PeopleFilters) => ({ to: "/users" as const, search });

  return (
    <dl className="ppl-band">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("people.band.people")}</dt>
        <dd className="ppl-value">{n(total)}</dd>
        <dd className="ppl-note">
          {stats.new_last_30d
            ? t("people.band.activeAndNew", { active: n(stats.active), n: n(stats.new_last_30d) })
            : t("people.band.activeNoneNew", { active: n(stats.active) })}
        </dd>
        <dd className="ppl-chart">
          <span
            role="img"
            aria-label={t("people.band.growthLabel", {
              from: n(months[0] ?? 0),
              to: n(months[months.length - 1] ?? 0),
              months: GROWTH_MONTHS,
            })}
          >
            <Sparkline values={months} width={132} height={40} />
          </span>
          <span className="ppl-chart-caption" aria-hidden="true">
            {t("people.band.months", { months: GROWTH_MONTHS })}
          </span>
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("people.band.twoStep")}</dt>
        <dd className="ppl-value">{t("people.band.percent", { n: share })}</dd>
        <dd className={share < TWO_STEP_TARGET ? "ppl-note is-warning" : "ppl-note"}>
          {t("people.band.twoStepNote", {
            n: n(stats.mfa_enabled),
            total: n(total),
            target: TWO_STEP_TARGET,
          })}
        </dd>
        <dd className="ppl-meter">
          <Meter
            value={share}
            tone={share < TWO_STEP_TARGET ? "warning" : "success"}
            aria-label={t("people.band.twoStepLabel", { n: share, target: TWO_STEP_TARGET })}
          />
          <span
            className="ppl-target"
            style={{ insetInlineStart: `${TWO_STEP_TARGET}%` }}
            aria-hidden="true"
          />
        </dd>
        {stats.mfa_missing ? (
          <dd className="ppl-link">
            <Link {...to({ twostep: "off" })}>
              {t("people.band.withoutTwoStep", { n: n(stats.mfa_missing) })}
            </Link>
          </dd>
        ) : null}
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("people.band.lastActive")}</dt>
        <dd className="ppl-recency">
          <SplitBar
            label={seen.map((s) => `${t(`people.recency.${s.id}`)}: ${n(s.count)}`).join(", ")}
            parts={seen.map((s) => ({ value: s.count, color: `var(--ppl-${s.id})` }))}
          />
        </dd>
        <dd className="ppl-recency-legend">
          <ul>
            {seen.map((s) => (
              <li key={s.id}>
                <Link {...to({ seen: s.id })}>
                  <span className={`ppl-swatch is-${s.id}`} aria-hidden="true" />
                  <b>{n(s.count)}</b> {t(`people.recency.${s.id}`).toLowerCase()}
                </Link>
              </li>
            ))}
          </ul>
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("people.band.needsALook")}</dt>
        <dd className="ppl-looks">
          <ul>
            {LOOKS.map((look) => {
              const count = users.filter((u) => needsLook(u, look, now)).length;
              const tone = count && look === "admins-no-two-step" ? "is-danger" : undefined;
              return (
                <li key={look} className={count ? undefined : "is-zero"}>
                  <Link {...to(look === "suspended" ? { status: "suspended" } : { look })}>
                    <span>{t(`people.looks.${look}`)}</span>
                    <b className={tone}>{n(count)}</b>
                  </Link>
                </li>
              );
            })}
          </ul>
        </dd>
      </div>
    </dl>
  );
}
