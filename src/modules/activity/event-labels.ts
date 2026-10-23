// Product wording for backend event enums such as `auth.login_succeeded`, which the console
// never shows raw, and the event outcome, which is distinct from log severity.

import i18n from "@/i18n";
import type { Severity } from "./types/activity.types";

/** Lowercases an event type and joins its words with single dots. */
function normalizeType(type: string): string {
  return type
    .toLowerCase()
    .replace(/[\s_]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.|\.$/g, "");
}

/** True for strings that look like a raw backend enum rather than prose. */
function looksLikeEnum(value: string): boolean {
  return /[._]/.test(value);
}

/** Sentence-cases an event type: "user.mfa_required_set" → "User mfa required set". */
export function humanizeEventType(type: string): string {
  const words = normalizeType(type).replace(/\./g, " ").trim();
  if (!words) return i18n.t("activity:eventType.fallback");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Returns an event's display title: the curated label, else the server title if it reads as
 * prose, else the humanized type, so an enum-shaped title never shows.
 */
export function formatEventTitle(event: { type: string; title?: string }): string {
  // Curated titles are `activity:eventType.<normalized type, dots as underscores>`.
  const key = `activity:eventType.${normalizeType(event.type).replace(/\./g, "_")}`;
  if (i18n.exists(key)) return i18n.t(key);
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
