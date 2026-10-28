import { formatNumber, Meter } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { SplitBar } from "@/modules/dashboard";
import {
  type OrgFilters,
  type OrgLook,
  type OrgReading,
  type OrgRow,
  lookCounts,
  roleCounts,
  STALE_DAYS,
} from "@/modules/organizations/orgs-model";

const BIGGEST = 4;
// The Users band's ordinal ramp (people.css), a step apart so neighbours separate: the strongest
// role darkest; past three roles, the rest share the lightest.
const ROLE_SWATCH = ["today", "month", "older", "never"] as const;

/**
 * The list's key numbers, in its header above the table, on the Users band's parts: people across
 * the organisations (the largest as bars, each opening its page), two-step coverage against the
 * Users target, your roles, and what needs a look. Each opens the list filtered to it.
 * `invitations` is how many organisations wait for an answer; undefined while it loads.
 */
export function OrgsBand({
  rows,
  reading,
  invitations,
}: {
  rows: OrgRow[];
  reading: OrgReading;
  invitations?: number;
}) {
  const { t } = useTranslation("organizations");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const to = (search: OrgFilters) => ({ to: "/organizations" as const, search });

  const people = rows.reduce((sum, row) => sum + (row.member_count ?? 0), 0);
  const twoStep = rows.reduce((sum, row) => sum + (row.mfa_enabled_count ?? 0), 0);
  const share = people ? Math.round((twoStep / people) * 100) : 0;
  const biggest = [...rows]
    .sort((a, b) => (b.member_count ?? 0) - (a.member_count ?? 0))
    .slice(0, BIGGEST);
  const top = biggest[0]?.member_count || 1;
  const counts = lookCounts(rows, reading);
  const roles = roleCounts(rows);
  const shown = roles.slice(0, 3);
  const others = roles.slice(3).reduce((sum, r) => sum + r.count, 0);
  const parts = [
    ...shown.map((r, i) => ({ id: r.role, count: r.count, swatch: ROLE_SWATCH[i] ?? "never" })),
    ...(others ? [{ id: "", count: others, swatch: "never" as const }] : []),
  ];
  const looks: { id: OrgLook | "invitations"; count: number; warn?: boolean }[] = [
    { id: "below-target", count: counts["below-target"], warn: true },
    { id: "stale", count: counts.stale },
    ...(counts.deleting ? [{ id: "deleting" as const, count: counts.deleting, warn: true }] : []),
    { id: "suspended", count: counts.suspended, warn: true },
    ...(invitations !== undefined ? [{ id: "invitations" as const, count: invitations }] : []),
  ];

  return (
    <dl className="ppl-band">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("list.band.people")}</dt>
        <dd className="ppl-value">{n(people)}</dd>
        <dd className="ppl-note">
          {rows.length > BIGGEST
            ? t("list.band.inLargest", { n: n(rows.length), largest: BIGGEST })
            : t("list.band.inOrganisations", { count: rows.length, n: n(rows.length) })}
        </dd>
        <dd className="org-bars">
          <ul>
            {biggest.map((row) => (
              <li key={row.id}>
                <Link
                  className="org-bar-name"
                  to="/organizations/$orgId"
                  params={{ orgId: row.id }}
                  aria-label={t("list.band.barLabel", {
                    name: row.name,
                    n: n(row.member_count ?? 0),
                  })}
                >
                  {row.name}
                </Link>
                <span className="org-bar-track" aria-hidden="true">
                  <span
                    className="org-bar-fill"
                    style={{
                      inlineSize: `${Math.max(2, ((row.member_count ?? 0) / top) * 100)}%`,
                    }}
                  />
                </span>
                <b aria-hidden="true">{n(row.member_count ?? 0)}</b>
              </li>
            ))}
          </ul>
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("list.band.twoStep")}</dt>
        <dd className="ppl-value">{t("list.band.percent", { n: share })}</dd>
        <dd className={share < reading.target ? "ppl-note is-warning" : "ppl-note"}>
          {t("list.band.twoStepNote", { n: n(twoStep), total: n(people), target: reading.target })}
        </dd>
        <dd className="ppl-meter">
          <Meter
            value={share}
            tone={share < reading.target ? "warning" : "success"}
            aria-label={t("list.band.twoStepLabel", { n: share, target: reading.target })}
          />
          <span
            className="ppl-target"
            style={{ insetInlineStart: `${reading.target}%` }}
            aria-hidden="true"
          />
        </dd>
        {counts["below-target"] ? (
          <dd className="ppl-link">
            <Link {...to({ look: "below-target" })}>
              {t("list.band.belowIt", {
                count: counts["below-target"],
                n: n(counts["below-target"]),
              })}
            </Link>
          </dd>
        ) : null}
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("list.band.yourRole")}</dt>
        <dd className="ppl-recency">
          <SplitBar
            label={parts
              .map((p) => `${p.id || t("list.band.otherRoles")}: ${n(p.count)}`)
              .join(", ")}
            parts={parts.map((p) => ({ value: p.count, color: `var(--ppl-${p.swatch})` }))}
          />
        </dd>
        <dd className="ppl-recency-legend">
          <ul>
            {parts.map((p) => (
              <li key={p.id || "other"}>
                {p.id ? (
                  <Link {...to({ role: p.id })}>
                    <span className={`ppl-swatch is-${p.swatch}`} aria-hidden="true" />
                    <b>{n(p.count)}</b> {p.id.toLowerCase()}
                  </Link>
                ) : (
                  <span>
                    <span className={`ppl-swatch is-${p.swatch}`} aria-hidden="true" />
                    <b>{n(p.count)}</b> {t("list.band.otherRoles")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("list.band.needsALook")}</dt>
        <dd className="ppl-looks">
          <ul>
            {looks.map((look) => (
              <li key={look.id} className={look.count ? undefined : "is-zero"}>
                <Link
                  {...(look.id === "invitations"
                    ? { to: "/select-organization" as const }
                    : to({ look: look.id }))}
                >
                  <span>
                    {t(`list.band.looks.${look.id}`, {
                      target: reading.target,
                      days: STALE_DAYS,
                    })}
                  </span>
                  <b className={look.count && look.warn ? "is-warning" : undefined}>
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
