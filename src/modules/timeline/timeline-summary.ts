// Identity-timeline summary — computed client-side from the events currently
// loaded into the timeline. There is no per-user summary endpoint (the server
// summary is tenant-wide), so these counts are an honest reflection of the
// loaded/filtered window, not the user's entire lifetime. Pure + testable.

import type { ActivityEvent } from "@/modules/activity";

export interface TimelineSummary {
  /** Total loaded events in the current window. */
  total: number;
  authentication: number;
  security: number;
  admin: number;
  sessions: number;
  /** Distinct actors seen across the loaded events. */
  uniqueActors: number;
}

const AUTH_CATEGORIES = new Set(["authentication", "mfa"]);
const SECURITY_CATEGORIES = new Set(["security", "authorization"]);
const SESSION_CATEGORIES = new Set(["session", "sessions"]);
const ADMIN_ACTOR_TYPES = new Set(["admin", "administrator"]);

function normalize(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z-]/g, "");
}

export function computeTimelineSummary(events: ActivityEvent[]): TimelineSummary {
  const actors = new Set<string>();
  let authentication = 0;
  let security = 0;
  let admin = 0;
  let sessions = 0;

  for (const event of events) {
    const category = normalize(event.category);
    if (AUTH_CATEGORIES.has(category)) authentication++;
    if (SECURITY_CATEGORIES.has(category)) security++;
    if (SESSION_CATEGORIES.has(category)) sessions++;
    if (category === "administration" || ADMIN_ACTOR_TYPES.has(normalize(event.actor?.type)))
      admin++;

    const actorKey = event.actor?.id ?? event.actor?.name;
    if (actorKey) actors.add(actorKey);
  }

  return {
    total: events.length,
    authentication,
    security,
    admin,
    sessions,
    uniqueActors: actors.size,
  };
}

/** Category values a summary card maps to when clicked (drives the category filter). */
export const SUMMARY_CATEGORY_FILTERS = {
  authentication: ["authentication", "mfa"],
  security: ["security", "authorization"],
  admin: ["administration"],
  sessions: ["sessions"],
} as const satisfies Record<string, string[]>;
