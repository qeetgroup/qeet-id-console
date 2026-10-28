import { Badge, formatNumber } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { Sparkline } from "@/modules/dashboard";
import type { DirectoryEvent, DirectoryEventPage } from "@/modules/directory/api/directory";
import { dailyColumns } from "@/modules/directory/connections-model";
import type { DirectoryConnection } from "@/modules/directory/directory-model";
import { runKey } from "@/modules/directory/sync-model";
import type { ActivityFilters } from "@/modules/directory/sync-search";
import { DayColumns } from "../connections/day-columns";
import { useConnectionNames, When } from "./sync-parts";

export const RESULT_TONE = { success: "success", warning: "warning", failed: "danger" } as const;

/**
 * The list's key numbers, in its header above the tabs, on the Users band's parts: the period's
 * events a day with their failures, each connection's events, the people and groups synced, and
 * the latest run. They follow the period only, so they stay put while the list is filtered.
 */
export function ActivityBand({
  days,
  month,
  failed,
  connections,
  byConnection,
  filters,
  now,
}: {
  days: number;
  /** The period's summary, volume and latest event (the server's, one row). */
  month: DirectoryEventPage;
  /** Its failures (up to 100), to mark the days they happened. */
  failed: readonly DirectoryEvent[];
  connections: readonly DirectoryConnection[];
  /** Each connection's summary over the period, by connection id. */
  byConnection: ReadonlyMap<string, DirectoryEventPage["summary"]>;
  filters: ActivityFilters;
  now: number;
}) {
  const { t } = useTranslation("directory");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const nameOf = useConnectionNames(connections);
  const { total, failed: failures } = month.summary;
  const columns = dailyColumns(month.volume, failed, now, days);
  const people = month.volume.reduce((sum, d) => sum + d.users, 0);
  const groups = month.volume.reduce((sum, d) => sum + d.groups, 0);
  const latest = month.items[0];

  return (
    <dl className="ppl-band">
      <div className="ppl-cell">
        <dt className="ppl-label">{t(`sync.periods.${filters.period ?? "30d"}`)}</dt>
        <dd className="ppl-value">{n(total)}</dd>
        <dd className={failures ? "ppl-note is-warning" : "ppl-note"}>
          {t("activity.band.events", { count: total, n: n(failures) })}
        </dd>
        <dd className="dir-days-cell">
          <DayColumns
            days={columns}
            label={t("connections.band.daysLabel", { days, n: n(failures) })}
          />
        </dd>
        {failures && filters.result !== "failed" ? (
          <dd className="ppl-link">
            <Link to="/directory/sync-activity" search={{ ...filters, result: "failed" }} replace>
              {t("activity.band.showFailed", { n: n(failures) })}
            </Link>
          </dd>
        ) : null}
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("activity.band.byConnection")}</dt>
        <dd className="sync-conns">
          {connections.length ? (
            <ul>
              {connections.map((c) => {
                const summary = byConnection.get(c.id);
                return (
                  <li key={c.id}>
                    <Link
                      to="/directory/sync-activity"
                      search={{ ...filters, connection: c.id }}
                      replace
                      aria-current={filters.connection === c.id ? "true" : undefined}
                    >
                      <span className="sync-name">{nameOf(c.id)}</span>
                      <small>
                        {summary ? (
                          <>
                            {t("activity.band.connectionEvents", {
                              count: summary.total,
                              n: n(summary.total),
                            })}
                            {summary.failed ? (
                              <>
                                {" · "}
                                <span className="sync-failed">
                                  {t("activity.band.connectionFailed", { n: n(summary.failed) })}
                                </span>
                              </>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </small>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <span className="ppl-note">{t("activity.band.noConnections")}</span>
          )}
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("activity.band.synced")}</dt>
        <dd className="ppl-value">{n(people)}</dd>
        <dd className="ppl-note">
          {t("activity.band.syncedNote", {
            count: people,
            groups: t("sync.changed.groups", { count: groups, n: n(groups) }),
          })}
        </dd>
        {columns.some((d) => d.changes) ? (
          <dd className="ppl-chart" aria-hidden="true">
            <Sparkline
              values={columns.map((d) => d.changes)}
              color="var(--ppl-month)"
              width={160}
              height={32}
            />
          </dd>
        ) : null}
        <dd className="ppl-note">{t("activity.band.syncedHow")}</dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("activity.band.latest")}</dt>
        {latest ? (
          <>
            <dd className="ppl-value">
              <When at={latest.started_at} now={now} />
            </dd>
            <dd className="ppl-note">
              {t("activity.band.latestNote", {
                run: t(runKey(latest)),
                connection: nameOf(latest.connection_id),
              })}
            </dd>
            <dd>
              <Badge tone={RESULT_TONE[latest.status]} size="sm">
                {t(`sync.results.${latest.status}`)}
              </Badge>
            </dd>
          </>
        ) : (
          <dd className="ppl-note">{t("activity.band.nothing")}</dd>
        )}
      </div>
    </dl>
  );
}
