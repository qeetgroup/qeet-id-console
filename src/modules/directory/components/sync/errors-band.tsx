import { formatNumber } from "@qeetrix/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { DirectoryErrorPage } from "@/modules/directory/api/directory";
import type { DirectoryConnection } from "@/modules/directory/directory-model";
import { causeCounts, connectionCounts } from "@/modules/directory/sync-model";
import type { ErrorsFilters } from "@/modules/directory/sync-search";
import { useConnectionNames, whenText } from "./sync-parts";

/**
 * The list's key numbers, in its header above the tabs, on the Users band's parts: what's open
 * (whatever its age, up to the 90 days the server keeps), by cause and by connection (each a way
 * into the list), and what was closed in those 90 days, marked resolved or by a check that passed.
 */
export function ErrorsBand({
  open,
  all,
  connections,
  filters,
  now,
}: {
  /** The open failures (up to 100) and their counts. */
  open: DirectoryErrorPage;
  /** The 90 days' failures: their counts, and the latest closed. */
  all: DirectoryErrorPage;
  connections: readonly DirectoryConnection[];
  filters: ErrorsFilters;
  now: number;
}) {
  const { t } = useTranslation("directory");
  const n = (value: number) => formatNumber(value, formatLocale());
  const nameOf = useConnectionNames(connections);
  const causes = causeCounts(open.items);
  const byConnection = connectionCounts(open.items);
  const oldest = open.items[open.items.length - 1];
  const retried = all.summary.retried;
  const resolved = Math.max(0, all.total - all.summary.open - retried);
  const lastClosed = all.remediations[0]?.resolved_at;

  return (
    <dl className="ppl-band">
      <div className="ppl-cell">
        <dt className="ppl-label">{t("errors.band.open")}</dt>
        <dd className={open.summary.open ? "ppl-value sync-danger" : "ppl-value"}>
          {n(open.summary.open)}
        </dd>
        <dd className="ppl-note">
          {open.summary.open
            ? t("errors.band.openNote", {
                critical: n(open.summary.critical),
                warning: n(open.summary.warning),
              })
            : t("errors.band.noneOpen")}
        </dd>
        {oldest ? (
          <dd className="ppl-note">
            {t("errors.band.since", { when: whenText(oldest.started_at, now) })}
          </dd>
        ) : null}
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("errors.band.byCause")}</dt>
        <dd className="dir-health sync-counts">
          {causes.length ? (
            <ul>
              {causes.map(([cause, count]) => (
                <li key={cause}>
                  <span>{t(`errors.causes.${cause}.name`)}</span>
                  <b>{n(count)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <span className="ppl-note">{t("errors.band.nothing")}</span>
          )}
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("errors.band.byConnection")}</dt>
        <dd className="ppl-looks">
          {byConnection.length ? (
            <ul>
              {byConnection.map(([id, count]) => (
                <li key={id}>
                  <Link
                    to="/directory/sync-errors"
                    search={{ ...filters, connection: id }}
                    replace
                    aria-current={filters.connection === id ? "true" : undefined}
                  >
                    <span className="sync-name">{nameOf(id)}</span>
                    <b className="is-danger">{n(count)}</b>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <span className="ppl-note">{t("errors.band.nothing")}</span>
          )}
        </dd>
      </div>

      <div className="ppl-cell">
        <dt className="ppl-label">{t("errors.band.closed", { days: 90 })}</dt>
        <dd className="ppl-value">{n(resolved + retried)}</dd>
        <dd className="ppl-note">
          {t("errors.band.closedNote", { resolved: n(resolved), retried: n(retried) })}
        </dd>
        {lastClosed ? (
          <dd className="ppl-note">
            {t("errors.band.lastClosed", { when: whenText(lastClosed, now) })}
          </dd>
        ) : null}
      </div>
    </dl>
  );
}
