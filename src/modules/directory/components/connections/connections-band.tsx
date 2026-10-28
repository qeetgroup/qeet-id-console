import { CircleCheckIcon, CircleDashedIcon, CircleXIcon } from "@qeetrix/icons";
import { formatDate, formatNumber } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { SplitBar } from "@/modules/dashboard";
import {
  DAYS,
  dailyColumns,
  type HealthState,
  healthCounts,
  peopleSources,
} from "@/modules/directory/connections-model";
import type { DirectoryConnection } from "@/modules/directory/directory-model";

export const HEALTH_ICONS = {
  healthy: CircleCheckIcon,
  failing: CircleXIcon,
  unchecked: CircleDashedIcon,
} as const;
const HEALTH_TONE: Record<HealthState, string> = {
  healthy: "is-ok",
  failing: "is-danger",
  unchecked: "is-muted",
};

/**
 * The list's key numbers, in its header above the tabs, on the Users band's parts: where the
 * organisation's people come from (SCIM, LDAP, managed here), each connection's health, the last
 * 30 days (changes synced a day, failures on top), and what needs a look.
 */
export function ConnectionsBand({
  connections,
  people,
  volume,
  failed,
  totalEvents,
  openErrors,
  now,
}: {
  connections: DirectoryConnection[];
  /** Everyone in the organisation; undefined without user.read. */
  people?: number;
  volume: { date: string; users: number; groups: number }[];
  failed: { started_at: string }[];
  totalEvents: number;
  openErrors: number;
  now: number;
}) {
  const { t } = useTranslation("directory");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const sources = peopleSources(connections, people ?? 0);
  const health = healthCounts(connections);
  const days = dailyColumns(volume, failed, now);
  const top = Math.max(1, ...days.map((d) => d.changes + d.failed));
  const failures = failed.length;
  const drafts = connections.filter((c) => c.status === "draft").length;
  const scim = connections.find((c) => c.type === "scim");
  const ldap = connections.find((c) => c.type === "ldap");

  return (
    <dl className="ppl-band">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("connections.band.people")}</dt>
        <dd className="ppl-value">{n(sources.fromDirectories)}</dd>
        {people !== undefined ? (
          <>
            <dd className="ppl-note">
              {t("connections.band.peopleNote", { n: n(people), here: n(sources.here) })}
            </dd>
            <dd className="ppl-recency">
              <SplitBar
                label={t("connections.band.peopleLabel", {
                  scim: n(sources.scim),
                  ldap: sources.ldap === null ? t("connections.band.notCounted") : n(sources.ldap),
                  here: n(sources.here),
                })}
                parts={[
                  { value: sources.scim, color: "var(--ppl-today)" },
                  { value: sources.ldap ?? 0, color: "var(--ppl-month)" },
                  { value: sources.here, color: "var(--ppl-never)" },
                ]}
              />
            </dd>
          </>
        ) : null}
        <dd className="ppl-recency-legend">
          <ul>
            <li className={sources.scim ? undefined : "is-zero"}>
              <Link to={scim ? "/directory/connections/scim" : "/directory/connections"}>
                <span className="ppl-swatch is-today" aria-hidden="true" />
                <b>{n(sources.scim)}</b> {t("connections.band.scim")}
              </Link>
            </li>
            <li className={sources.ldap ? undefined : "is-zero"}>
              <Link to={ldap ? "/directory/connections/ldap" : "/directory/connections"}>
                <span className="ppl-swatch is-month" aria-hidden="true" />
                <b>{sources.ldap === null ? "—" : n(sources.ldap)}</b>{" "}
                {sources.ldap === null
                  ? t("connections.band.ldapNotCounted")
                  : t("connections.band.ldap")}
              </Link>
            </li>
            {people !== undefined ? (
              <li>
                <Link to="/users">
                  <span className="ppl-swatch is-never" aria-hidden="true" />
                  <b>{n(sources.here)}</b> {t("connections.band.here")}
                </Link>
              </li>
            ) : null}
          </ul>
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("connections.band.health")}</dt>
        <dd className="dir-health">
          <ul>
            {(["healthy", "failing", "unchecked"] as const).map((state) => {
              const Icon = HEALTH_ICONS[state];
              return (
                <li
                  key={state}
                  className={health[state] ? HEALTH_TONE[state] : `${HEALTH_TONE[state]} is-zero`}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{t(`connections.health.${state}`)}</span>
                  <b>{n(health[state])}</b>
                </li>
              );
            })}
          </ul>
        </dd>
        <dd className="ppl-note">{t("connections.band.healthNote")}</dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("connections.band.days", { days: DAYS })}</dt>
        <dd className="ppl-value">{n(totalEvents)}</dd>
        <dd className={failures ? "ppl-note is-warning" : "ppl-note"}>
          {t("connections.band.events", { count: totalEvents, n: n(failures) })}
        </dd>
        <dd className="dir-days-cell">
          {/* The picture is a span inside the dd: a dd with an image role isn't a dd any more. */}
          <span
            className="dir-days"
            role="img"
            aria-label={t("connections.band.daysLabel", { days: DAYS, n: n(failures) })}
          >
            {days.map((d) => (
              <span
                key={d.date}
                className="dir-day"
                title={t("connections.band.dayTitle", {
                  date: formatDate(d.date, locale, { dateStyle: "medium" }),
                  changes: n(d.changes),
                  failed: n(d.failed),
                })}
              >
                {d.failed ? (
                  <span
                    className="dir-day-failed"
                    style={{ blockSize: `${Math.max(4, (d.failed / top) * 100)}%` }}
                  />
                ) : null}
                {d.changes ? (
                  <span
                    className="dir-day-ok"
                    style={{ blockSize: `${(d.changes / top) * 100}%` }}
                  />
                ) : null}
              </span>
            ))}
          </span>
        </dd>
        {failures ? (
          <dd className="ppl-link">
            <Link to="/directory/sync-activity">
              {t("connections.band.failedLink", { n: n(failures) })}
            </Link>
          </dd>
        ) : null}
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("connections.band.needsALook")}</dt>
        <dd className="ppl-looks">
          <ul>
            <li className={openErrors ? undefined : "is-zero"}>
              <Link to="/directory/sync-errors">
                <span>{t("connections.band.looks.errors")}</span>
                <b className={openErrors ? "is-danger" : undefined}>{n(openErrors)}</b>
              </Link>
            </li>
            <li className={health.failing ? undefined : "is-zero"}>
              <Link to="/directory/connections" search={{ show: "failing" }}>
                <span>{t("connections.band.looks.failing")}</span>
                <b className={health.failing ? "is-danger" : undefined}>{n(health.failing)}</b>
              </Link>
            </li>
            <li className={drafts ? undefined : "is-zero"}>
              <Link to="/directory/connections" search={{ show: "draft" }}>
                <span>{t("connections.band.looks.drafts")}</span>
                <b>{n(drafts)}</b>
              </Link>
            </li>
          </ul>
        </dd>
      </div>
    </dl>
  );
}
