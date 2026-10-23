import type { ActivityEvent, DateGroup } from "@/modules/activity";

const MS_PER_DAY = 86_400_000;

function startOfDayMs(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Groups newest-first events into Today / Yesterday / Last Week / Last Month / Older, keeping
 * their order. Unlike activity's groupByDate it has a Last Month bucket, so a timeline that
 * spans months doesn't collapse into Older.
 */
export function groupTimelineByDate(events: ActivityEvent[], now = new Date()): DateGroup[] {
  if (events.length === 0) return [];

  const todayStart = startOfDayMs(now);
  const yesterdayStart = todayStart - MS_PER_DAY;
  const lastWeekStart = todayStart - 7 * MS_PER_DAY;
  const lastMonthStart = todayStart - 30 * MS_PER_DAY;

  const today: ActivityEvent[] = [];
  const yesterday: ActivityEvent[] = [];
  const lastWeek: ActivityEvent[] = [];
  const lastMonth: ActivityEvent[] = [];
  const older: ActivityEvent[] = [];

  for (const event of events) {
    const ts = new Date(event.at).getTime();
    if (ts >= todayStart) today.push(event);
    else if (ts >= yesterdayStart) yesterday.push(event);
    else if (ts >= lastWeekStart) lastWeek.push(event);
    else if (ts >= lastMonthStart) lastMonth.push(event);
    else older.push(event);
  }

  const result: DateGroup[] = [];
  if (today.length > 0) result.push({ label: "Today", events: today });
  if (yesterday.length > 0) result.push({ label: "Yesterday", events: yesterday });
  if (lastWeek.length > 0) result.push({ label: "Last Week", events: lastWeek });
  if (lastMonth.length > 0) result.push({ label: "Last Month", events: lastMonth });
  if (older.length > 0) result.push({ label: "Older", events: older });
  return result;
}
