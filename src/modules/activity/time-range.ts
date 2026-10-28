// The time-range presets and their resolution, apart from the picker: the route's search schema
// reads them, and the picker belongs to the pages that show it.

import type { DateRange as PickerRange } from "@qeetrix/react/experimental";

/** A custom range of whole days, "YYYY-MM-DD", as the date-range picker holds it. */
export type DateRange = PickerRange;

// Each preset's label is `activityTimeRange.presets.<value>`. The identity timeline offers "all";
// Activity doesn't, because its counts can't cover all time (see ACTIVITY_RANGES).
export const TIME_PRESETS = (["all", "15m", "1h", "24h", "7d", "30d", "custom"] as const).map(
  (value) => ({ value }),
);

/**
 * The Activity page's ranges. No "all time": the server's summary covers at most 90 days (and the
 * last 24 hours when no start is given), so its counts would describe another window than the
 * list's. 90 days is the longest the counts can match.
 */
export const ACTIVITY_RANGES = ["15m", "1h", "24h", "7d", "30d", "90d", "custom"] as const;
export type ActivityRange = (typeof ACTIVITY_RANGES)[number];
export const DEFAULT_ACTIVITY_RANGE: ActivityRange = "24h";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const RELATIVE: Record<string, number> = {
  "15m": 15 * MINUTE,
  "1h": HOUR,
  "24h": DAY,
  "7d": 7 * DAY,
  "30d": 30 * DAY,
  "90d": 90 * DAY,
};

/** A "YYYY-MM-DD" day as a local date, at its start. */
function localDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** A moment's local day, "YYYY-MM-DD". */
export function dayOf(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** The whole local days a picked range covers, as an RFC 3339 window. */
export function rangeToWindow(range: DateRange): { from: string; to: string } {
  const start = localDay(range.start);
  const end = localDay(range.end);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** The days a window covers, for the picker; undefined without a valid start. */
export function windowToRange(from?: string, to?: string): DateRange | undefined {
  const start = from ? new Date(from) : undefined;
  if (!start || Number.isNaN(start.getTime())) return undefined;
  const end = to ? new Date(to) : start;
  const last = Number.isNaN(end.getTime()) || end < start ? start : end;
  return { start: dayOf(start), end: dayOf(last) };
}

/**
 * Resolves a preset (and custom range) to an RFC 3339 window. Relative presets leave `to` open
 * so newer events still match; a custom range covers whole local days. "all", or "custom" without
 * a range, returns an empty window.
 */
export function presetToRange(preset: string, custom?: DateRange): { from: string; to: string } {
  const span = RELATIVE[preset];
  if (span) return { from: new Date(Date.now() - span).toISOString(), to: "" };
  if (preset === "custom" && custom) return rangeToWindow(custom);
  return { from: "", to: "" };
}
