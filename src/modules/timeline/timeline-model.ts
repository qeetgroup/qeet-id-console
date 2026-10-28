// A person's timeline, worked out from the activity API (GET /v1/activity and /summary with
// `subject`: every event the person did, and every event on their user record). The period and
// its days, the period summed up, and what each event says. No React or strings here: the page
// words them.

import type { ActivityEvent, ActivitySummary } from "@/modules/activity";
import { isOneOf } from "@/shared/utils/one-of";

// ── The period ─────────────────────────────────────────────────────────────────────────────

/** How far back the page looks. The summary endpoint caps its window at 90 days. */
export const PERIODS = ["7d", "30d", "90d"] as const;
export type Period = (typeof PERIODS)[number];
export const DEFAULT_PERIOD: Period = "30d";
const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };
export const periodDays = (period: Period) => PERIOD_DAYS[period];

/** The server's categories, which the Kind filter narrows to (`activity:category.*`). */
export const KINDS = [
  "authentication",
  "authorization",
  "directory",
  "security",
  "developer",
  "system",
] as const;
export type Kind = (typeof KINDS)[number];

/** What the address holds: the period (30 days when absent), a kind, and failures only. */
export type TimelineSearch = { period?: Period; kind?: Kind; result?: "failed" };

/** Local midnight, `offset` days from `at`'s day. */
function dayOf(at: Date | number, offset = 0): Date {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
}

const pad = (n: number) => String(n).padStart(2, "0");
/** A local day's key, "2026-10-26". */
export const dayKey = (at: Date | number | string) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** The period's first moment: local midnight, `days - 1` days before today. */
export function periodStart(period: Period, now: number): Date {
  return dayOf(now, -(PERIOD_DAYS[period] - 1));
}

/** Each day of the period, oldest first, as local midnights. */
export function periodDayList(period: Period, now: number): Date[] {
  return Array.from({ length: PERIOD_DAYS[period] }, (_, i) =>
    dayOf(now, i - (PERIOD_DAYS[period] - 1)),
  );
}

// ── The period summed up ───────────────────────────────────────────────────────────────────

export type DayCount = { day: Date; count: number; failed: number };

/**
 * Events and failures per local day of the period, from the summary's series. Its buckets are a
 * quarter of an hour on the epoch, so they fall wholly inside one local day in every time zone.
 */
export function eventsByDay(
  series: ActivitySummary["series"],
  period: Period,
  now: number,
): DayCount[] {
  const days = periodDayList(period, now).map((day) => ({ day, count: 0, failed: 0 }));
  const index = new Map(days.map((d, i) => [dayKey(d.day), i]));
  for (const bucket of series) {
    const row = days[index.get(dayKey(bucket.at)) ?? -1];
    if (!row) continue;
    row.count += bucket.count;
    row.failed += bucket.failed;
  }
  return days;
}

/** What a sign-in's `method` was, without its second step (`<first factor>_mfa`). */
export const SIGN_IN_METHODS = [
  "saml",
  "password",
  "ldap",
  "social",
  "magic_link",
  "passkey",
  "password_email_confirmed",
] as const;
export type SignInMethod = (typeof SIGN_IN_METHODS)[number] | "other";

/** How a sign-in failed (auth.sign_in_failed's `reason`). */
export const FAILURE_REASONS = [
  "wrong_password",
  "code_invalid",
  "account_locked",
  "source_throttled",
  "unknown_account",
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number] | "other";

/** Methods that move a session between organisations: recorded as sign-ins, but not one. */
const MOVES = ["tenant_switch", "tenant_create"] as const;

const meta = (e: ActivityEvent, key: string): string => {
  const value = e.metadata?.[key];
  return typeof value === "string" ? value : "";
};

/**
 * A sign-in's method and whether it met two-step: a met challenge ("_mfa") or a passkey, as the
 * server's secondFactorOfMethod has it.
 */
export function signInMethod(e: ActivityEvent): { method: SignInMethod; twoStep: boolean } {
  const raw = meta(e, "method");
  const first = raw.endsWith("_mfa") ? raw.slice(0, -4) : raw;
  return {
    method: isOneOf(SIGN_IN_METHODS, first) ? first : "other",
    twoStep: raw.endsWith("_mfa") || raw === "passkey",
  };
}

export const failureReason = (e: ActivityEvent): FailureReason => {
  const reason = meta(e, "reason");
  return isOneOf(FAILURE_REASONS, reason) ? reason : "other";
};

export type SignInSummary = {
  signIns: number; // auth.login_succeeded, not counting moves between organisations
  twoStep: number;
  moves: number; // switches into the organisation, and entering one just made
  top?: { method: SignInMethod; count: number };
  last?: ActivityEvent;
  failures: { reason: FailureReason; count: number }[]; // most first
  failed: number;
  addresses: { ip: string; count: number }[]; // most first
  browsers: string[]; // most used first
};

/** Counts and ranks a person's sign-ins and failed sign-ins (newest first). */
export function sumSignIns(events: ActivityEvent[]): SignInSummary {
  const methods = new Map<SignInMethod, number>();
  const reasons = new Map<FailureReason, number>();
  const ips = new Map<string, number>();
  const browsers = new Map<string, number>();
  let signIns = 0;
  let twoStep = 0;
  let moves = 0;
  let failed = 0;
  let last: ActivityEvent | undefined;
  const bump = <K>(map: Map<K, number>, key: K) => map.set(key, (map.get(key) ?? 0) + 1);

  for (const e of events) {
    if (e.type === "auth.login_succeeded") {
      if (isOneOf(MOVES, meta(e, "method"))) {
        moves++;
        continue;
      }
      const m = signInMethod(e);
      signIns++;
      if (m.twoStep) twoStep++;
      bump(methods, m.method);
      last ??= e;
    } else if (e.type === "auth.sign_in_failed") {
      failed++;
      bump(reasons, failureReason(e));
    } else continue;
    if (e.ip) bump(ips, e.ip);
    if (e.browser) bump(browsers, e.browser);
  }

  const ranked = <K>(map: Map<K, number>) => [...map].sort((a, b) => b[1] - a[1]);
  const [topMethod] = ranked(methods);
  return {
    signIns,
    twoStep,
    moves,
    top: topMethod ? { method: topMethod[0], count: topMethod[1] } : undefined,
    last,
    failures: ranked(reasons).map(([reason, count]) => ({ reason, count })),
    failed,
    addresses: ranked(ips).map(([ip, count]) => ({ ip, count })),
    browsers: ranked(browsers).map(([name]) => name),
  };
}

// ── Each event ─────────────────────────────────────────────────────────────────────────────

/** Events with one sentence each, whoever did them (`event.plain.<key>`). */
export const PLAIN = {
  "auth.mfa_challenged": "mfaChallenged",
  "auth.mfa_verified": "mfaVerified",
  "auth.sign_in_confirmed": "signInConfirmed",
  "auth.magic_link_requested": "magicLinkRequested",
  "auth.magic_link_consumed": "magicLinkConsumed",
  "auth.trusted_device_added": "trustedDeviceAdded",
  "auth.password_changed": "passwordChanged",
  "auth.password_reset_requested": "passwordResetRequested",
  "auth.password_reset_confirmed": "passwordResetConfirmed",
  "auth.other_sessions_revoked": "otherSessionsRevoked",
  "mfa.totp_enroll_started": "totpStarted",
  "mfa.totp_enrolled": "totpEnrolled",
  "mfa.recovery_code_used": "recoveryCodeUsed",
  "mfa.step_up_required": "stepUpRequired",
  "invite.accepted": "inviteAccepted",
  "invite.declined": "inviteDeclined",
  "email.verification_started": "emailVerificationStarted",
  "email.verified": "emailVerified",
  "email.verification_failed": "emailVerificationFailed",
  "apikey.revoked": "apiKeyRevoked",
} as const;
type PlainKey = (typeof PLAIN)[keyof typeof PLAIN];

/**
 * Events on a person's user record, worded two ways: about the person (`event.about.<key>`:
 * "Account created") and, on an admin's timeline, about the person they acted on
 * (`event.toOther.<key>`: "Added Riya Sharma").
 */
export const ON_PERSON = {
  "user.created": "created",
  "user.deleted": "deleted",
  "user.suspended": "suspended",
  "user.reactivated": "reactivated",
  "user.suspension_reviewed": "suspensionReviewed",
  "user.updated": "updated",
  "user.password_set": "passwordSet",
  "user.mfa_required_set": "mfaRequiredSet",
  "mfa.otp_factor_added": "otpFactorAdded",
  "session.admin_revoked_all": "signedOutEverywhere",
  "role.assigned": "roleAssigned",
  "role.unassigned": "roleUnassigned",
} as const;
type OnPersonKey = (typeof ON_PERSON)[keyof typeof ON_PERSON];

const has = <T extends object>(map: T, key: string): key is Extract<keyof T, string> =>
  Object.hasOwn(map, key);

/** What an event says, before it is worded: which sentence, and what goes in it. */
export type EventTitle =
  | { kind: "signedIn"; method: SignInMethod; twoStep: boolean }
  | { kind: "moved"; method: (typeof MOVES)[number] }
  | { kind: "signInFailed"; reason: FailureReason }
  | { kind: "accountLocked"; failures?: number }
  | { kind: "sessionEnded"; idle: boolean }
  | { kind: "codeSent"; channel: "email" | "sms" | "other" }
  | { kind: "samlApp"; app: string }
  | { kind: "apiKeyCreated"; name: string }
  | { kind: "invited"; email: string }
  | { kind: "plain"; key: PlainKey }
  | { kind: "about"; key: OnPersonKey; roleId?: string }
  | { kind: "toOther"; key: OnPersonKey; personId?: string; roleId?: string }
  | { kind: "other" };

/** Reads what an event says, for the person `userId`'s timeline. */
export function eventTitle(e: ActivityEvent, userId: string): EventTitle {
  const type = e.type;
  if (type === "auth.login_succeeded") {
    const method = meta(e, "method");
    if (isOneOf(MOVES, method)) return { kind: "moved", method };
    return { kind: "signedIn", ...signInMethod(e) };
  }
  if (type === "auth.sign_in_failed") return { kind: "signInFailed", reason: failureReason(e) };
  if (type === "auth.account_locked") {
    const failures = e.metadata?.failures;
    return { kind: "accountLocked", failures: typeof failures === "number" ? failures : undefined };
  }
  if (type === "auth.session_expired")
    return { kind: "sessionEnded", idle: meta(e, "reason") === "idle" };
  if (type === "mfa.otp_sent") {
    const channel = meta(e, "channel");
    return {
      kind: "codeSent",
      channel: channel === "email" || channel === "sms" ? channel : "other",
    };
  }
  if (type === "saml.idp_assertion_issued")
    return { kind: "samlApp", app: appName(meta(e, "sp_entity_id")) };
  if (type === "apikey.created" && meta(e, "name"))
    return { kind: "apiKeyCreated", name: meta(e, "name") };
  if (type === "invite.created" && meta(e, "email"))
    return { kind: "invited", email: meta(e, "email") };
  if (has(PLAIN, type)) return { kind: "plain", key: PLAIN[type] };
  if (has(ON_PERSON, type)) {
    const roleId = meta(e, "role_id") || undefined;
    const target = e.target?.type === "user" ? e.target.id : undefined;
    return target && target !== userId
      ? { kind: "toOther", key: ON_PERSON[type], personId: target, roleId }
      : { kind: "about", key: ON_PERSON[type], roleId };
  }
  return { kind: "other" };
}

/** A SAML app's entity ID, as a person reads it: "https://slack.com/" is "slack.com". */
export function appName(entityId: string): string {
  return entityId.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Which app a sign-in link or reset was for: hosted login, or the console's own sign-in page. */
export function linkApp(e: ActivityEvent): "hosted" | "console" | undefined {
  if (!e.type.startsWith("auth.magic_link_") && e.type !== "auth.password_reset_requested")
    return undefined;
  return meta(e, "app") === "hosted_login" ? "hosted" : "console";
}

/** Who did it: the person, someone else (by name), or a part of Qeet ID. */
export const SERVICES = [
  "system",
  "scim",
  "ldap",
  "admin_portal",
  "anonymous",
  "device",
  "client",
] as const;
export type Who =
  | { kind: "self" }
  | { kind: "person"; name?: string }
  | { kind: "service"; service: (typeof SERVICES)[number] };

export function whoDid(e: ActivityEvent, userId: string): Who {
  const actor = e.actor;
  if (actor?.id === userId) return { kind: "self" };
  const type = actor?.type ?? "system";
  if (type === "user") return { kind: "person", name: actor?.name || undefined };
  return isOneOf(SERVICES, type) ? { kind: "service", service: type } : { kind: "person" };
}

/**
 * The event's record in Activity: that day, with the event open. The Organisations page's history
 * links the same way (orgs-model's activityAt).
 */
export function activityRecord(e: Pick<ActivityEvent, "id" | "at">) {
  const from = dayOf(Date.parse(e.at));
  return {
    range: "custom",
    from: from.toISOString(),
    to: new Date(dayOf(from, 1).getTime() - 1).toISOString(),
    event: e.id,
  };
}

/** Events in groups by local day, newest first, as they arrive. */
export function byDay(
  events: ActivityEvent[],
): { key: string; day: Date; events: ActivityEvent[] }[] {
  const out: { key: string; day: Date; events: ActivityEvent[] }[] = [];
  for (const e of events) {
    const key = dayKey(e.at);
    const group = out.at(-1);
    if (group?.key === key) group.events.push(e);
    else out.push({ key, day: dayOf(Date.parse(e.at)), events: [e] });
  }
  return out;
}
