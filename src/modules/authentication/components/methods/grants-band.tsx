import { formatNumber } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { SplitBar } from "@/modules/dashboard";
import { ACCESS, type GrantRow } from "./grants-model";

// The application split: the biggest few by name, the rest as one part (the Users band's ordinal
// ramp, bigger darker; "others" its neutral step).
const SHADES = ["today", "week", "month", "older"] as const;

/**
 * The list's key numbers, in its header, on the Users band's parts (until PageHeader has a band of
 * its own, QTRX-18; the share bar is the Dashboard's until QTRX-13): how many grants for how many
 * people, which applications hold them, and what they let the applications read. Each opens the
 * list filtered to it.
 */
export function GrantsBand({ rows }: { rows: GrantRow[] }) {
  const { t } = useTranslation("consent");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const people = new Set(rows.map((row) => row.user_id)).size;

  const apps = new Map<string, { name: string; count: number }>();
  for (const row of rows) {
    const app = apps.get(row.client_id);
    apps.set(row.client_id, { name: row.app, count: (app?.count ?? 0) + 1 });
  }
  const ranked = [...apps.entries()].sort((a, b) => b[1].count - a[1].count);
  const top = ranked.slice(0, SHADES.length);
  const other = ranked.slice(SHADES.length).reduce((sum, [, app]) => sum + app.count, 0);

  return (
    <dl className="ppl-band is-three">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("band.grants")}</dt>
        <dd className="ppl-value">{n(rows.length)}</dd>
        <dd className="ppl-note">{t("band.people", { count: people, n: n(people) })}</dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("band.byApp")}</dt>
        <dd className="ppl-recency">
          <SplitBar
            label={ranked.map(([, app]) => `${app.name}: ${n(app.count)}`).join(", ")}
            parts={[
              ...top.map(([, app], index) => ({
                value: app.count,
                color: `var(--ppl-${SHADES[index] ?? "older"})`,
              })),
              { value: other, color: "var(--ppl-never)" },
            ]}
          />
        </dd>
        <dd className="ppl-recency-legend">
          <ul>
            {top.map(([id, app], index) => (
              <li key={id}>
                <Link to="/auth/api/consent-grants" search={{ app: id }}>
                  <span
                    className={`ppl-swatch is-${SHADES[index] ?? "older"}`}
                    aria-hidden="true"
                  />
                  {app.name} <b>{n(app.count)}</b>
                </Link>
              </li>
            ))}
            {other > 0 && (
              <li>
                <span className="am-legend-plain">
                  <span className="ppl-swatch is-never" aria-hidden="true" />
                  {t("band.otherApps", { count: ranked.length - top.length })} <b>{n(other)}</b>
                </span>
              </li>
            )}
          </ul>
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("band.access")}</dt>
        <dd className="ppl-looks">
          <ul>
            {ACCESS.map((a) => {
              const count = rows.filter((row) => row.scopes.includes(a)).length;
              return (
                <li key={a} className={count ? undefined : "is-zero"}>
                  <Link to="/auth/api/consent-grants" search={{ access: a }}>
                    <span>{t(`band.reads.${a}`)}</span>
                    <b>{n(count)}</b>
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
