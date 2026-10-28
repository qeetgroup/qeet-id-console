// The person's timeline page reads GET /v1/activity and /v1/activity/summary with `subject`: the
// events the person did, and those on their user record (audit.read). Only the page uses these.

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import type { ActivityEvent, ActivitySummary } from "@/modules/activity";
import { api } from "@/platform/api/client";
import type { Kind } from "../timeline-model";
import { timelineKeys } from "./keys";

type EventsPage = { events: ActivityEvent[]; next_cursor?: string };

/** What the list asks for: the period's start, a kind (a server category) and failures only. */
export type EventsQuery = { from: string; kind?: Kind; failed?: boolean };

export const EVENTS_PAGE = 100;
/** The most sign-ins the band reads for its ranks (5 pages of the server's largest, 200). */
export const SIGN_IN_CAP = 1000;
const SIGN_IN_PAGE = 200;
const SIGN_IN_TYPES = "auth.login_succeeded,auth.sign_in_failed";
// The summary's buckets: a quarter of an hour, so they fold into local days in any time zone.
const SUMMARY_BUCKET = 900;

/**
 * The list's query: `category` and `severity` are filtered by the server after it reads a page
 * (`severity=error` is error and critical, the failures), so a page can come back short.
 */
export function eventsParams(userId: string, q: EventsQuery, cursor = "", limit = EVENTS_PAGE) {
  return {
    subject: userId,
    from: q.from,
    category: q.kind,
    severity: q.failed ? "error" : undefined,
    cursor: cursor || undefined,
    limit,
  };
}

export async function fetchEvents(
  userId: string,
  q: EventsQuery,
  cursor = "",
  limit = EVENTS_PAGE,
  signal?: AbortSignal,
) {
  return api<EventsPage>("/v1/activity", { query: eventsParams(userId, q, cursor, limit), signal });
}

export const timelineQueries = {
  /** The period's totals and its series (the window from `from` to now, capped at 90 days). */
  summary: (tenantId: string | null, userId: string, from: string) =>
    queryOptions({
      queryKey: timelineKeys.period(tenantId, userId, "summary", { from }),
      queryFn: ({ signal }) =>
        api<ActivitySummary>("/v1/activity/summary", {
          query: { subject: userId, from, bucket: SUMMARY_BUCKET },
          signal,
        }),
      staleTime: 30_000,
      meta: { silent: true },
    }),

  /** The period's sign-ins and failed sign-ins, newest first, up to SIGN_IN_CAP. */
  signIns: (tenantId: string | null, userId: string, from: string) =>
    queryOptions({
      queryKey: timelineKeys.period(tenantId, userId, "sign-ins", { from }),
      queryFn: async ({ signal }) => {
        const events: ActivityEvent[] = [];
        let cursor = "";
        do {
          const page = await api<EventsPage>("/v1/activity", {
            query: { subject: userId, from, types: SIGN_IN_TYPES, limit: SIGN_IN_PAGE, cursor },
            signal,
          });
          events.push(...page.events);
          cursor = page.next_cursor ?? "";
        } while (cursor && events.length < SIGN_IN_CAP);
        return { events, capped: !!cursor };
      },
      staleTime: 30_000,
      meta: { silent: true },
    }),

  /** The events themselves, a page at a time, newest first. */
  events: (tenantId: string | null, userId: string, q: EventsQuery) =>
    infiniteQueryOptions({
      queryKey: timelineKeys.period(tenantId, userId, "events", q),
      queryFn: ({ pageParam, signal }) => fetchEvents(userId, q, pageParam, EVENTS_PAGE, signal),
      initialPageParam: "",
      getNextPageParam: (page) => page.next_cursor || undefined,
      staleTime: 30_000,
      meta: { silent: true },
    }),
};
