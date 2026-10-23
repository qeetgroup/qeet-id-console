// Product wording for backend event enums such as `auth.login_succeeded`, which the console
// never shows raw, and the event outcome, which is distinct from log severity.

import type { Severity } from "./types/activity.types";

/** Lowercases an event type and joins its words with single dots. */
function normalizeType(type: string): string {
  return type
    .toLowerCase()
    .replace(/[\s_]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.|\.$/g, "");
}

/** Titles for known event types, keyed by normalized type. */
const EVENT_LABELS: Record<string, string> = {
  "auth.login": "Sign-in attempt",
  "auth.login.succeeded": "Successful sign-in",
  "auth.login.failed": "Sign-in failed",
  "auth.logout": "Signed out",
  "auth.mfa.challenge.created": "MFA challenge issued",
  "auth.mfa.challenged": "MFA challenge issued",
  "auth.mfa.verified": "MFA verification succeeded",
  "auth.mfa.enrollment.deferred": "MFA setup postponed",
  "auth.mfa.challenge.expired": "MFA challenge expired",
  "auth.mfa.succeeded": "MFA verification succeeded",
  "auth.mfa.verification.succeeded": "MFA verification succeeded",
  "auth.mfa.failed": "MFA verification failed",
  "auth.password.reset.requested": "Password reset requested",
  "auth.suspicious.detected": "Suspicious sign-in detected",
  "user.login": "Signed in",
  "user.created": "User created",
  "user.updated": "User updated",
  "user.deleted": "User deleted",
  "user.restored": "User restored",
  "user.suspended": "User suspended",
  "user.password.changed": "Password changed",
  "user.mfa.required.set": "MFA requirement enabled",
  "user.mfa.required.enabled": "MFA requirement enabled",
  "user.mfa.required.disabled": "MFA requirement disabled",
  "user.mfa.reset": "MFA reset",
  "user.group.added": "Added to group",
  "user.group.removed": "Removed from group",
  "user.role.assigned": "Role assigned",
  "user.role.removed": "Role removed",
  "session.created": "New session created",
  "session.revoked": "Session revoked",
  "session.expired": "Session expired",
  "token.issued": "Token issued",
  "token.revoked": "Token revoked",
  "device.registered": "Device registered",
  "device.removed": "Device removed",
  "api.token.created": "API token created",
  "api.token.revoked": "API token revoked",
  "apikey.created": "API key created",
  "apikey.revoked": "API key revoked",
  "tenant.created": "Organization created",
  "webhook.delivery.failed": "Webhook delivery failed",
};

/** True for strings that look like a raw backend enum rather than prose. */
function looksLikeEnum(value: string): boolean {
  return /[._]/.test(value);
}

/** Sentence-cases an event type: "user.mfa_required_set" → "User mfa required set". */
export function humanizeEventType(type: string): string {
  const words = normalizeType(type).replace(/\./g, " ").trim();
  if (!words) return "Event";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Returns an event's display title: the curated label, else the server title if it reads as
 * prose, else the humanized type, so an enum-shaped title never shows.
 */
export function formatEventTitle(event: { type: string; title?: string }): string {
  const mapped = EVENT_LABELS[normalizeType(event.type)];
  if (mapped) return mapped;
  const title = event.title?.trim();
  if (title && !looksLikeEnum(title)) return title;
  return humanizeEventType(event.type);
}

export type EventResult = "Success" | "Failed" | "Blocked" | "Warning" | "Info";

const SEVERITY_RESULT: Record<Severity, EventResult> = {
  success: "Success",
  warning: "Warning",
  error: "Failed",
  critical: "Failed",
  info: "Info",
};

const BLOCKED_RE = /(suspicious|anomal|block|denied|deny|reject)/;
const FAILED_RE = /(fail|invalid|error|unauthorized)/;
const SUCCESS_RE =
  /(success|succeed|created|enabled|disabled|added|assigned|granted|issued|verified|completed|updated|changed|removed|revoked|deleted|restored|registered|rotated|\bset\b|reset|logout)/;

/**
 * Returns the event's outcome, which can differ from its severity: Blocked, Failed or Success
 * when its status or type says so (checked in that order), else the severity's result.
 */
export function eventResult(event: {
  status?: string;
  severity: Severity;
  type?: string;
}): EventResult {
  const hay = `${(event.status ?? "").toLowerCase()} ${normalizeType(event.type ?? "")}`;
  if (BLOCKED_RE.test(hay)) return "Blocked";
  if (FAILED_RE.test(hay)) return "Failed";
  if (SUCCESS_RE.test(hay)) return "Success";
  return SEVERITY_RESULT[event.severity];
}
