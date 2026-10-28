// The Analytics report's arithmetic: the range's days and the period before it, the daily series
// filled in from the server's sparse buckets, and how a total changed. Pure, so it's tested alone.

/** The ranges the report offers; the audit summary reads at most 90 days at a time. */
export const RANGES = ["7d", "30d", "90d"] as const;
export type RangeKey = (typeof RANGES)[number];
export const DEFAULT_RANGE: RangeKey = "30d";
export const RANGE_DAYS: Record<RangeKey, number> = { "7d": 7, "30d": 30, "90d": 90 };

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export type ReportWindow = {
  days: number;
  /** The range: from the start of its first UTC day to now (left open, so today keeps counting). */
  from: string;
  /** The period before it, of the same number of days, up to the moment the range starts. */
  previousFrom: string;
  previousTo: string;
  /** Each day of the range and of the period before, "YYYY-MM-DD", oldest first. */
  dates: string[];
  previousDates: string[];
};

/**
 * The window for `range` as of `today` ("YYYY-MM-DD", UTC): the server buckets by UTC day, as the
 * Dashboard's 14-day chart does, so the two agree day for day.
 */
export function reportWindow(range: RangeKey, today: string): ReportWindow {
  const days = RANGE_DAYS[range];
  const start = Date.parse(`${today}T00:00:00Z`) - (days - 1) * DAY;
  const previousStart = start - days * DAY;
  return {
    days,
    from: new Date(start).toISOString(),
    previousFrom: new Date(previousStart).toISOString(),
    previousTo: new Date(start - 1).toISOString(),
    dates: Array.from({ length: days }, (_, i) => isoDay(start + i * DAY)),
    previousDates: Array.from({ length: days }, (_, i) => isoDay(previousStart + i * DAY)),
  };
}

/** One count per date, from buckets that leave out empty days. */
export function dailyCounts(
  series: readonly { at: string; count: number }[] | undefined,
  dates: readonly string[],
): number[] {
  const byDay = new Map<string, number>();
  for (const b of series ?? []) {
    const day = b.at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + b.count);
  }
  return dates.map((d) => byDay.get(d) ?? 0);
}

export const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

export type Change =
  | { kind: "up" | "down"; pct: number }
  | { kind: "same" }
  | { kind: "new" } // none before, some now
  | { kind: "none" }; // none either time

/** How `now` compares with `before`, in whole percent. */
export function changeOf(now: number, before: number): Change {
  if (before === 0) return now === 0 ? { kind: "none" } : { kind: "new" };
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return { kind: "same" };
  return pct > 0 ? { kind: "up", pct } : { kind: "down", pct: -pct };
}

/** Monday first. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * The average count on each day of the week, Monday first, over the range's full days (today is
 * still counting, so it's left out). Null when the range is too short for an average to mean much.
 */
export function weekdayAverages(
  counts: readonly number[],
  dates: readonly string[],
): { weekday: number; average: number; days: number }[] | null {
  const full = dates.length - 1;
  if (full < 21) return null;
  const totals = new Map<number, { total: number; days: number }>();
  for (let i = 0; i < full; i++) {
    const weekday = new Date(`${dates[i]}T00:00:00Z`).getUTCDay();
    const t = totals.get(weekday) ?? { total: 0, days: 0 };
    totals.set(weekday, { total: t.total + (counts[i] ?? 0), days: t.days + 1 });
  }
  return WEEKDAYS.map((weekday) => {
    const t = totals.get(weekday) ?? { total: 0, days: 0 };
    return { weekday, average: t.days ? t.total / t.days : 0, days: t.days };
  });
}
