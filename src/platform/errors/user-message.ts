import { type ErrorCode, ERROR_CODES, type ErrorKind } from "@/platform/errors/error-codes";
import { normalizeError } from "@/platform/errors/normalize-error";

// The leak stop. Backend `error.message`/`detail` may carry internal context
// (stack hints, infra names), so the UI must NEVER render them directly. Instead
// we map known stable codes to curated copy and fall back to a safe generic
// message per kind. Seeded with the codes actually in flight today so common
// flows keep meaningful text; unknown codes degrade to the generic fallback.
//
// (Copy is English for now — the console's security surfaces are English-only
// until the i18n backfill; wiring these to i18n keys is tracked separately.)
const CODE_MESSAGES: Record<string, string> = {
  [ERROR_CODES.STEP_UP_REQUIRED]: "This action needs a fresh identity check.",
  [ERROR_CODES.SESSION_EXPIRED]: "Your session has expired. Please sign in again.",
  [ERROR_CODES.INVALID_STATE]: "That sign-in link is no longer valid. Please start again.",
  [ERROR_CODES.FORBIDDEN]: "You don't have access to do that.",
  [ERROR_CODES.MFA_CODE_INVALID]: "That code isn't valid. Check your authenticator and try again.",
  [ERROR_CODES.BILLING_PLAN_LIMIT]: "You've reached your plan's limit.",
  [ERROR_CODES.BILLING_UPGRADE_REQUIRED]: "This feature isn't included in your plan.",
  [ERROR_CODES.NETWORK]: "Can't reach the server. Check your connection and try again.",
};

const KIND_FALLBACK: Record<ErrorKind, string> = {
  auth: "Please sign in again to continue.",
  authz: "You don't have access to do that.",
  validation: "Some of the details entered aren't valid. Please review and try again.",
  network: "Can't reach the server. Check your connection and try again.",
  api: "Something went wrong. Please try again.",
  unknown: "Something went wrong. Please try again.",
};

/** A user-safe message for a code/kind — never the raw backend message. */
export function userMessageForCode(code: ErrorCode, kind: ErrorKind): string {
  return CODE_MESSAGES[code] ?? KIND_FALLBACK[kind];
}

/**
 * Convenience: normalize any thrown value and return its user-safe message.
 * Use this everywhere an error is shown inline instead of rendering
 * `error.message` (which would leak raw backend detail).
 */
export function errorMessage(err: unknown): string {
  const app = normalizeError(err);
  return userMessageForCode(app.code, app.kind);
}
