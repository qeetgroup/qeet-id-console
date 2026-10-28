// What the Activity page works out from the log and its summary: who an event's actor reads as,
// how many events a filter leaves when the server's counts can say, and the summary's series
// with its empty buckets filled.

import i18n from "@/i18n";
import { actorTypeLabel } from "./event-labels";
import type { ActivityEvent, ActivityFilters, ActivitySummary } from "./types/activity.types";

/** Who did it, as a list or the drawer names them. */
export interface EventActor {
  /** The name to show: a person, "Qeet ID", or "Not signed in". */
  name: string;
  /** A second line: whom Qeet ID acted for, or what kind of actor it is. */
  note?: string;
  /** The person behind it, when there is one, for links and the actor filter. */
  personId?: string;
  /** The person's name, when there is one, even when Qeet ID acted for them. */
  personName?: string;
  /** Qeet ID itself recorded it, on a request with no one signed in. */
  system: boolean;
}

/**
 * The actor as people read it. The server records `system` for a request with no one signed in
 * (a sign-in, a token refresh); with a person on it, Qeet ID acted for them.
 */
export function eventActor(event: Pick<ActivityEvent, "actor">): EventActor {
  const actor = event.actor;
  const id = actor?.id || undefined;
  const person = actor?.name || undefined;
  const type = actor?.type ?? (id ? "user" : "system");
  if (type === "system") {
    return {
      name: i18n.t("activity:actor.qeetId"),
      note: person ? i18n.t("activity:actor.forPerson", { name: person }) : undefined,
      personId: id,
      personName: person,
      system: true,
    };
  }
  if (type === "anonymous") {
    return { name: i18n.t("activity:actor.anonymous"), system: false };
  }
  const name =
    person ?? (type === "user" ? i18n.t("activity:actor.unknown") : actorTypeLabel(type));
  return {
    name,
    note: type === "user" || !person ? undefined : actorTypeLabel(type),
    personId: id,
    personName: person,
    system: false,
  };
}

/** The first name of a person's name, for "Events by Priya". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * How many events the filters leave in the summary's window, when its counts can say. The summary
 * takes the search, actor, event types and window, and reports the spread of severity and
 * category instead of filtering by them: so a severity filter is a sum of its buckets and a
 * category one its bucket, but not both at once. The address and resource filters run in the
 * browser, so no count fits them. Undefined when unknown.
 */
export function knownTotal(
  summary: ActivitySummary | undefined,
  filters: ActivityFilters,
): number | undefined {
  if (!summary || filters.ip || filters.resource || filters.category.length > 1) return undefined;
  const category = filters.category[0];
  if (category && filters.severity.length) return undefined;
  if (category) return summary.by_category[category] ?? 0;
  if (!filters.severity.length) return summary.total;
  return filters.severity.reduce((sum, s) => sum + (summary.by_severity[s] ?? 0), 0);
}

export type SeriesKey = "count" | "failed";

/**
 * The summary's series from the start of its window to its end, one value a bucket, with the
 * buckets the server leaves out (no events) as 0. Buckets start on whole multiples of the bucket
 * width since 1970, as the server cuts them.
 */
export function fillSeries(summary: ActivitySummary, key: SeriesKey): number[] {
  const step = summary.bucket_seconds * 1000;
  if (!step) return summary.series.map((b) => b[key]);
  const from = Math.floor(Date.parse(summary.window.from) / step) * step;
  const to = Date.parse(summary.window.to);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return [];
  const values = new Map(summary.series.map((b) => [Date.parse(b.at), b[key]]));
  const out: number[] = [];
  // A 90-day window in 30-minute buckets is ~4,300; past 500 the chart says nothing more.
  for (let at = from; at <= to && out.length < 500; at += step) out.push(values.get(at) ?? 0);
  return out;
}

/** A bucket width in words: "minute", "30 minutes", "hour", "2 days". */
export function bucketWords(seconds: number): string {
  if (seconds % 86_400 === 0)
    return i18n.t("activity:band.bucket.days", { count: seconds / 86_400 });
  if (seconds % 3600 === 0) return i18n.t("activity:band.bucket.hours", { count: seconds / 3600 });
  return i18n.t("activity:band.bucket.minutes", { count: Math.max(1, Math.round(seconds / 60)) });
}
