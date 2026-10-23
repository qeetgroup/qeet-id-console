import type { ActivityEvent } from "@/modules/activity";
import { api } from "@/platform/api/client";
import type { TimelineFilters } from "./timeline-store";

export type TimelinePage = {
  events: ActivityEvent[];
  next_cursor?: string;
};

export const TIMELINE_LIMIT = 50;

/** Returns the GET /v1/activity query for one user's timeline; empty filters are omitted. */
export function buildTimelineQuery(
  userId: string,
  filters: TimelineFilters,
  cursor: string,
): Record<string, string | number | undefined> {
  return {
    subject: userId,
    limit: TIMELINE_LIMIT,
    cursor: cursor || undefined,
    category: filters.category.join(",") || undefined,
    severity: filters.severity.join(",") || undefined,
    q: filters.q || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  };
}

/**
 * Fetches one page of a user's timeline. A 404, 503 or network error yields an empty page so the
 * timeline degrades gracefully; other errors throw.
 */
export async function fetchTimelinePage(
  userId: string,
  filters: TimelineFilters,
  cursor: string,
): Promise<TimelinePage> {
  const query = buildTimelineQuery(userId, filters, cursor);
  try {
    return await api<TimelinePage>("/v1/activity", { query });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (!status || status === 404 || status === 503) {
      return { events: [], next_cursor: undefined };
    }
    throw err;
  }
}
