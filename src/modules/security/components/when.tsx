import { formatDate, formatRelativeTime } from "@qeetrix/react";
import { RelativeTime } from "@qeetrix/react/experimental";

import { formatLocale } from "@/i18n";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * "3 hours ago", or past about a month the date itself. A past moment never reads as the future
 * (a clock a little ahead); `future` lets one that is due, such as an expiry, say "in 6 minutes".
 */
export function whenText(at: string, now = Date.now(), future = false): string {
  const locale = formatLocale();
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return "";
  if (Math.abs(now - ms) > MONTH_MS) return formatDate(at, locale, { dateStyle: "medium" });
  return formatRelativeTime(future ? ms : Math.min(ms, now), locale, now);
}

/** The same moment as Qeetrix's RelativeTime: a `<time>`, with the full date and time on hover. */
export function When({ at, now, future }: { at: string; now?: number; future?: boolean }) {
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return null;
  const moment = future ? ms : Math.min(ms, now ?? Date.now());
  return <RelativeTime date={moment} now={now} locale={formatLocale()} />;
}
