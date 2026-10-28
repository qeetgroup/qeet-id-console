// What a webhook's fields and its deliveries say about it, from the server's rules
// (internal/developer/webhooks/webhook.go), worded by the components (developer:webhooks.*).

import i18n, { isTranslationKey } from "@/i18n";

import type { Webhook, WebhookDelivery } from "./api/webhooks";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The server's retry cap: a delivery that fails this many times gives up. */
export const MAX_ATTEMPTS = 60;
/** An endpoint failing for this long is turned off at its next failure. */
export const TURN_OFF_AFTER = 3 * DAY;
/** The server returns this many deliveries, newest first, with no paging. */
export const DELIVERY_LIMIT = 50;

/** An endpoint's state; labelled `developer:webhooks.state.<state>`. */
export type WebhookState = "active" | "failing" | "disabled" | "autoDisabled";
export const WEBHOOK_STATES = ["active", "failing", "autoDisabled", "disabled"] as const;

/**
 * Returns the endpoint's state: off by an administrator (`disabled`) or by its own failures
 * (`autoDisabled`), or on and delivering (`active`) or on but failing (`failing`).
 */
export function webhookState(
  w: Pick<Webhook, "disabled_at" | "disabled_reason" | "failing_since">,
): WebhookState {
  if (w.disabled_at) return w.disabled_reason === "failing" ? "autoDisabled" : "disabled";
  return w.failing_since ? "failing" : "active";
}

/** When a failing endpoint is turned off, at its first failure after then; undefined if it isn't. */
export function turnsOffAt(w: Webhook): number | undefined {
  if (w.disabled_at || !w.failing_since) return undefined;
  return Date.parse(w.failing_since) + TURN_OFF_AFTER;
}

/** Until when the previous secret still signs, if it does (the field is never cleared). */
export function overlapUntil(w: Webhook, now: number): number | undefined {
  const until = w.previous_secret_expires_at
    ? Date.parse(w.previous_secret_expires_at)
    : Number.NaN;
  return Number.isFinite(until) && until > now ? until : undefined;
}

/**
 * A delivery's outcome. The server keeps no status word: delivered (`delivered_at`), gave up
 * (`dead_at`), or still to go: held while the endpoint is off, waiting for its first try, or
 * retrying. `next_attempt_at` stays set after success or giving up, so it can't tell them apart.
 */
export const OUTCOMES = ["delivered", "retrying", "queued", "held", "gaveUp"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export function outcomeOf(d: WebhookDelivery, w: Pick<Webhook, "disabled_at">): Outcome {
  if (d.delivered_at) return "delivered";
  if (d.dead_at) return "gaveUp";
  if (w.disabled_at) return "held";
  return d.attempt > 0 ? "retrying" : "queued";
}

/** A refusal the server doesn't retry: a 4xx other than 408 and 429 gives up at once. */
export const notRetried = (d: WebhookDelivery) =>
  !!d.status_code &&
  d.status_code >= 400 &&
  d.status_code < 500 &&
  d.status_code !== 408 &&
  d.status_code !== 429;

export function countOutcomes(
  deliveries: readonly WebhookDelivery[],
  w: Pick<Webhook, "disabled_at">,
): Record<Outcome, number> {
  const out: Record<Outcome, number> = { delivered: 0, retrying: 0, queued: 0, held: 0, gaveUp: 0 };
  for (const d of deliveries) out[outcomeOf(d, w)] += 1;
  return out;
}

export type HealthUnit = "minutes" | "hour" | "day";
export type HealthBucket = { start: number; counts: Record<Outcome, number>; total: number };

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * The deliveries over time, oldest first, in buckets sized to the span they cover (the server
 * returns the last 50, which a busy endpoint fills in minutes): 5 minutes up to 3 hours, an hour up
 * to 3 days, a day after that (at most `maxDays`). Every bucket from the first to now is there, so a
 * quiet spell shows as a gap.
 */
export function deliveriesOverTime(
  deliveries: readonly WebhookDelivery[],
  w: Pick<Webhook, "disabled_at">,
  now: number,
  maxDays = 30,
): { unit: HealthUnit; buckets: HealthBucket[] } {
  if (!deliveries.length) return { unit: "day", buckets: [] };
  const oldest = Math.min(...deliveries.map((d) => Date.parse(d.created_at)));
  const span = now - oldest;
  const unit: HealthUnit = span <= 3 * HOUR ? "minutes" : span <= 3 * DAY ? "hour" : "day";
  const size = unit === "minutes" ? 5 * 60_000 : HOUR;
  const floor = (t: number) => (unit === "day" ? startOfDay(t) : Math.floor(t / size) * size);
  // A day steps a day and a bit, then back to midnight, so a daylight-saving day doesn't repeat.
  const next = (t: number) => (unit === "day" ? startOfDay(t + DAY + 2 * HOUR) : t + size);
  const first = Math.max(floor(oldest), unit === "day" ? startOfDay(now - (maxDays - 1) * DAY) : 0);
  const buckets: HealthBucket[] = [];
  for (let start = first; start <= now; start = next(start))
    buckets.push({
      start,
      counts: { delivered: 0, retrying: 0, queued: 0, held: 0, gaveUp: 0 },
      total: 0,
    });
  for (const d of deliveries) {
    const slot = buckets.find((b) => b.start === floor(Date.parse(d.created_at)));
    if (!slot) continue;
    slot.counts[outcomeOf(d, w)] += 1;
    slot.total += 1;
  }
  return { unit, buckets };
}

/** The host an endpoint is known by, and the rest of its address; the URL if it doesn't parse. */
export function endpointParts(url: string): { host: string; path: string } {
  try {
    const u = new URL(url);
    const path = `${u.pathname}${u.search}`;
    return { host: u.host, path: path === "/" ? "" : path };
  } catch {
    return { host: url, path: "" };
  }
}

/** The catalogue's areas, in the console's order; an event's area is its name's first part. */
export const EVENT_AREAS = [
  "people",
  "signIn",
  "groups",
  "domains",
  "agents",
  "access",
  "authHooks",
  "logStreams",
  "rateLimits",
  "credentials",
  "applications",
  "organisation",
  "test",
] as const;
export type EventArea = (typeof EVENT_AREAS)[number];
const AREA_OF: Record<string, EventArea> = {
  user: "people",
  auth: "signIn",
  session: "signIn",
  token: "signIn",
  group: "groups",
  group_template: "groups",
  domain: "domains",
  agent: "agents",
  rebac: "access",
  abac_policy: "access",
  auth_hook: "authHooks",
  siem: "logStreams",
  rate_limits: "rateLimits",
  credential: "credentials",
  oidc: "applications",
  tenant: "organisation",
  test: "test",
};
export const areaOf = (event: string): EventArea =>
  AREA_OF[event.split(".")[0] ?? ""] ?? "organisation";

/** The areas `events` cover, in catalogue order, each with how many of its events they hold. */
export function eventAreas(events: readonly string[]): { area: EventArea; count: number }[] {
  return EVENT_AREAS.map((area) => ({
    area,
    count: events.filter((e) => areaOf(e) === area).length,
  })).filter((a) => a.count > 0);
}

/** Returns the console's description of a catalogue event, or undefined for one it doesn't know. */
export function webhookEventDescription(name: string): string | undefined {
  const key = `developer:webhookEvents.${name}`;
  return isTranslationKey(key) ? i18n.t(key) : undefined;
}
