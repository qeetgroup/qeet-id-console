// Library gap (new): RelativeTime — relative with the full date on hover, a plain date after about
// 30 days (redesign-findings §2 "Dates", §5; approved, not yet filed). Drawn here until then.
import { formatDate, formatDateTime, formatRelativeTime } from "@qeetrix/react";

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

/** `whenText` in a `<time>`, with the full date and time on hover. */
export function When({ at, now, future }: { at: string; now?: number; future?: boolean }) {
  const text = whenText(at, now, future);
  if (!text) return null;
  return (
    <time dateTime={at} title={formatDateTime(at, formatLocale())}>
      {text}
    </time>
  );
}
