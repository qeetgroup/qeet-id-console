// What the person's page works out from the server's views of one person: how their sign-ins went,
// what their permissions add up to, where their sessions sit in time, and what to call them.

import { translateDynamic } from "@/i18n";
import type { ActivityEvent } from "@/modules/activity";
import type { UserSession } from "./api/user360";

/** A person's name as the page writes it, and the first word of it for sentences. */
export function personNames(user: { display_name?: string | null; email: string }) {
  const full = user.display_name?.trim() || user.email;
  const first = user.display_name?.trim() ? (full.split(/\s+/)[0] ?? full) : full;
  return { full, first };
}

/** The ways a sign-in proves who someone is first, grouped as the page names them. */
export const SIGN_IN_METHODS = [
  "sso",
  "social",
  "password",
  "passkey",
  "magicLink",
  "other",
] as const;
export type SignInMethod = (typeof SIGN_IN_METHODS)[number];

/**
 * Reads a sign-in event's `metadata.method` (the server's `password`, `saml`, `social_mfa`…): the
 * first factor, and whether a second step was met. A `_mfa` suffix is a met challenge; a passkey
 * counts as the second step on its own (the server's secondFactorOfMethod).
 */
export function signInMethod(raw: unknown): { method: SignInMethod; secondStep: boolean } {
  const value = typeof raw === "string" ? raw.toLowerCase() : "";
  const challenged = value.endsWith("_mfa");
  const base = challenged ? value.slice(0, -4) : value;
  const method: SignInMethod =
    base === "saml" || base === "ldap" || base === "oidc" || base === "sso"
      ? "sso"
      : base === "social"
        ? "social"
        : base === "password" || base === "password_email_confirmed"
          ? "password"
          : base === "passkey" || base === "webauthn"
            ? "passkey"
            : base === "magic_link"
              ? "magicLink"
              : "other";
  return { method, secondStep: challenged || method === "passkey" };
}

export interface SignInMix {
  total: number;
  secondStep: number; // sign-ins that met a second step
  methods: { method: SignInMethod; count: number }[]; // most used first, none at zero
  last?: ActivityEvent;
}

/**
 * True for a recorded sign-in that is really a move between organisations: the server records
 * switching into one, or creating one, as `auth.login_succeeded` too.
 */
export function isOrganisationMove(event: ActivityEvent): boolean {
  const method = event.metadata?.method;
  return method === "tenant_switch" || method === "tenant_create";
}

/** How the person's sign-ins went: each method's share, and how many met a second step. */
export function signInMix(all: readonly ActivityEvent[]): SignInMix {
  const events = all.filter((event) => !isOrganisationMove(event));
  const counts = new Map<SignInMethod, number>();
  let secondStep = 0;
  for (const event of events) {
    const read = signInMethod(event.metadata?.method);
    counts.set(read.method, (counts.get(read.method) ?? 0) + 1);
    if (read.secondStep) secondStep += 1;
  }
  const methods = SIGN_IN_METHODS.flatMap((method) => {
    const count = counts.get(method) ?? 0;
    return count ? [{ method, count }] : [];
  }).sort((a, b) => b.count - a.count);
  return { total: events.length, secondStep, methods, last: events[0] };
}

/** One area of the product a person's permissions reach, and whether they can change it. */
export interface PermissionArea {
  resource: string; // the part before the dot: `apikey` in `apikey.write`
  permissions: string[];
  changes: boolean; // holds more than reading
  everything: boolean; // holds the wildcard
}

const READ_ONLY = new Set(["read", "list", "view"]);

/** The person's permissions grouped by what they reach, in the order the areas are named. */
export function permissionAreas(permissions: readonly string[]): PermissionArea[] {
  const by = new Map<string, string[]>();
  for (const permission of permissions) {
    const [resource = permission] = permission.split(".");
    by.set(resource, [...(by.get(resource) ?? []), permission]);
  }
  return [...by.entries()]
    .map(([resource, list]) => {
      const sorted = [...list].sort();
      const actions = sorted.map((p) => p.slice(resource.length + 1));
      return {
        resource,
        permissions: sorted,
        everything: resource === "*" || actions.includes("*"),
        changes: actions.some((a) => !READ_ONLY.has(a)),
      };
    })
    .sort((a, b) => a.resource.localeCompare(b.resource));
}

/** A session on the page's time ruler: where it opened and when it was last active, as shares. */
export interface SessionSpan {
  id: string;
  from: number; // 0–1 across the window
  to: number;
  before: boolean; // opened before the window starts
}

/** The days the Sessions ruler covers, ending now. */
export const RULER_DAYS = 14;

/** Places each live session on a ruler of the last `days` days, newest activity first. */
export function sessionSpans(sessions: readonly UserSession[], now: number, days = RULER_DAYS) {
  const start = now - days * 86_400_000;
  const share = (at: number) => Math.min(1, Math.max(0, (at - start) / (now - start)));
  const spans: SessionSpan[] = [...sessions]
    .sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))
    .map((s) => {
      const opened = Date.parse(s.created_at);
      const seen = Math.max(opened, Date.parse(s.last_seen_at));
      return { id: s.id, from: share(opened), to: share(seen), before: opened < start };
    });
  return { start, spans };
}

/** When the person was last active: their latest session's last request, if they have one. */
export function lastActive(sessions: readonly UserSession[]): UserSession | undefined {
  return [...sessions].sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))[0];
}

/** The Activity page at one event: the day it happened, and the event open. */
export function activityAt(event: Pick<ActivityEvent, "id" | "at">) {
  const at = new Date(event.at);
  const from = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  return {
    range: "custom",
    from: from.toISOString(),
    to: new Date(from.getTime() + 86_400_000 - 1).toISOString(),
    event: event.id,
  };
}

/** The person's record attributes that the page names, in its order; the rest follow by key. */
export const WORK_KEYS = [
  "title",
  "department",
  "team",
  "manager_email",
  "location",
  "employee_id",
] as const;
export type WorkKey = (typeof WORK_KEYS)[number];

/** The record's text attributes: the named ones first, then any other, skipping the locale. */
export function workAttributes(metadata: Record<string, unknown> | null | undefined) {
  const entries = Object.entries(metadata ?? {}).filter(
    (entry): entry is [string, string | number | boolean] =>
      entry[0] !== "locale" &&
      (typeof entry[1] === "string" ||
        typeof entry[1] === "number" ||
        typeof entry[1] === "boolean") &&
      String(entry[1]).trim() !== "",
  );
  const rank = (key: string) => {
    const i = (WORK_KEYS as readonly string[]).indexOf(key);
    return i === -1 ? WORK_KEYS.length : i;
  };
  return entries
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
    .map(([key, value]) => ({ key, value: String(value) }));
}

/** True for one of the attributes the page has a name for. */
export function isWorkKey(key: string): key is WorkKey {
  return (WORK_KEYS as readonly string[]).includes(key);
}

/** A sign-in provider's name: single sign-on, a directory or a social account; else in words. */
export function providerName(provider: string): string {
  return translateDynamic(`users:person.providers.${provider.toLowerCase()}`);
}
