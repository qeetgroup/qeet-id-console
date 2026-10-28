import { formatDate, formatNumber } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";

/**
 * A column a day, oldest first: the people and groups synced that day, its failures on top in the
 * danger colour (connections.css). Connections' band shows the last 30 days; Sync activity's the
 * chosen period. The picture is a span in its dd: a dd with an image role isn't a dd any more.
 */
export function DayColumns({
  days,
  label,
}: {
  days: readonly { date: string; changes: number; failed: number }[];
  /** The picture's text: what it shows, in a sentence. */
  label: string;
}) {
  const { t } = useTranslation("directory");
  const locale = formatLocale();
  const n = (value: number) => formatNumber(value, locale);
  const top = Math.max(1, ...days.map((d) => d.changes + d.failed));
  return (
    <span
      className="dir-days"
      role="img"
      aria-label={label}
      style={
        days.length === 30
          ? undefined
          : { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }
      }
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
            <span className="dir-day-ok" style={{ blockSize: `${(d.changes / top) * 100}%` }} />
          ) : null}
        </span>
      ))}
    </span>
  );
}
