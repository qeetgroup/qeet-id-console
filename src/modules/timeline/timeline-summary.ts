import type { ActivityEvent } from "@/modules/activity";

export interface TimelineSummary {
  total: number; // Loaded events in the current window
  authentication: number;
  security: number; // access decisions and security signals
  directory: number; // people, groups and organization changes
  developer: number; // developer resources and the platform itself
  uniqueActors: number; // Distinct actors across the loaded events
}

/** The server categories each summary card counts, and filters on when clicked. */
export const SUMMARY_CATEGORY_FILTERS = {
  authentication: ["authentication"],
  security: ["security", "authorization"],
  directory: ["directory"],
  developer: ["developer", "system"],
} as const satisfies Record<string, readonly string[]>;

type SummaryCard = keyof typeof SUMMARY_CATEGORY_FILTERS;

/**
 * Counts the loaded timeline events by kind. There is no per-user summary endpoint (the server
 * summary is tenant-wide), so the counts cover only the loaded, filtered events.
 */
export function computeTimelineSummary(events: ActivityEvent[]): TimelineSummary {
  const actors = new Set<string>();
  const counts: Record<SummaryCard, number> = {
    authentication: 0,
    security: 0,
    directory: 0,
    developer: 0,
  };

  for (const event of events) {
    const category = (event.category ?? "").toLowerCase();
    for (const card of Object.keys(SUMMARY_CATEGORY_FILTERS) as SummaryCard[]) {
      if ((SUMMARY_CATEGORY_FILTERS[card] as readonly string[]).includes(category)) counts[card]++;
    }
    const actorKey = event.actor?.id ?? event.actor?.name;
    if (actorKey) actors.add(actorKey);
  }

  return { total: events.length, ...counts, uniqueActors: actors.size };
}
