// Product wording for backend event enums such as `auth.login_succeeded`, which the console
// never shows raw, and the event outcome, which is distinct from log severity.

import i18n, { isTranslationKey, translateDynamic } from "@/i18n";
import type { Severity } from "./types/activity.types";

/** Lowercases an event type and joins its words with single dots. */
function normalizeType(type: string): string {
  return type
    .toLowerCase()
    .replace(/[\s_]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.|\.$/g, "");
}

/** The categories the server files events under, in the order filters list them. */
export const ACTIVITY_CATEGORIES = [
  "authentication",
  "authorization",
  "security",
  "directory",
  "developer",
  "system",
] as const;

/** Returns an event category's name, such as "Directory"; an unknown one reads as words. */
export function categoryLabel(category: string): string {
  return translateDynamic(`activity:category.${category}`);
}

/** Returns an actor type's name, such as "API key"; an unknown one reads as words. */
export function actorTypeLabel(type: string): string {
  return translateDynamic(`activity:actorType.${type}`);
}

/** Returns a severity's name, such as "Failed" (the server's word for its error severity). */
export function severityLabel(severity: Severity): string {
  return i18n.t(`activity:severity.${severity}`);
}

// Words the server's enums abbreviate, written as people write them.
const ACRONYMS = new Set([
  "abac",
  "api",
  "gdpr",
  "id",
  "ip",
  "ldap",
  "mfa",
  "oidc",
  "otp",
  "rbac",
  "rebac",
  "saml",
  "scim",
  "siem",
  "sms",
  "sso",
  "totp",
  "url",
]);

/**
 * An enum's words in sentence case: acronyms in capitals, and "tenant" (or the US spelling) as
 * "organisation", which is what the console calls one.
 */
function sentence(words: string[]): string {
  const text = words
    .map((w) =>
      w === "tenant" || w === "organization"
        ? "organisation"
        : ACRONYMS.has(w)
          ? w.toUpperCase()
          : w,
    )
    .join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Returns a resource type's name, such as "Organisation" for `tenant`; an unknown one reads as
 * words in sentence case ("export_request" is "Export request").
 */
export function resourceLabel(type: string): string {
  const key = `activity:resource.${type.toLowerCase()}`;
  if (isTranslationKey(key)) return i18n.t(key);
  const words = normalizeType(type).split(".").filter(Boolean);
  return words.length ? sentence(words) : type;
}

/** True for strings that look like a raw backend enum rather than prose. */
function looksLikeEnum(value: string): boolean {
  return /[._]/.test(value);
}

/**
 * Sentence-cases an event type: "user.mfa_required_set" → "User MFA required set". "auth" names
 * the area, not the event, so "auth.signed_out" reads "Signed out".
 */
export function humanizeEventType(type: string): string {
  const words = normalizeType(type).split(".").filter(Boolean);
  if (words[0] === "auth" && words.length > 1) words.shift();
  if (!words.length) return i18n.t("activity:eventType.fallback");
  return sentence(words);
}

/**
 * Returns an event's display title: the curated label, else the server title if it reads as
 * prose, else the humanized type, so an enum-shaped title never shows.
 */
export function formatEventTitle(event: { type: string; title?: string }): string {
  // Curated titles are `activity:eventType.<normalized type, dots as underscores>`.
  const key = `activity:eventType.${normalizeType(event.type).replace(/\./g, "_")}`;
  if (isTranslationKey(key)) return i18n.t(key);
  const title = event.title?.trim();
  if (title && !looksLikeEnum(title)) return title;
  return humanizeEventType(event.type);
}

/** An event's outcome, labelled `activity:result.<result>`. */
export type EventResult = "success" | "failed" | "blocked" | "warning" | "info";

const SEVERITY_RESULT: Record<Severity, EventResult> = {
  success: "success",
  warning: "warning",
  error: "failed",
  critical: "failed",
  info: "info",
};

const BLOCKED_RE = /(suspicious|anomal|block|denied|deny|reject)/;
const FAILED_RE = /(fail|invalid|error|unauthorized)/;
const SUCCESS_RE =
  /(success|succeed|created|enabled|disabled|added|assigned|granted|issued|verified|completed|updated|changed|removed|revoked|deleted|restored|registered|rotated|\bset\b|reset|logout)/;

/**
 * Returns the event's outcome, which can differ from its severity: blocked, failed or success
 * when its status or type says so (checked in that order), else the severity's result.
 */
export function eventResult(event: {
  status?: string;
  severity: Severity;
  type?: string;
}): EventResult {
  const hay = `${(event.status ?? "").toLowerCase()} ${normalizeType(event.type ?? "")}`;
  if (BLOCKED_RE.test(hay)) return "blocked";
  if (FAILED_RE.test(hay)) return "failed";
  if (SUCCESS_RE.test(hay)) return "success";
  return SEVERITY_RESULT[event.severity];
}
