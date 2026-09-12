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
  // Signup conflict. The backend returns 409 auth.email_exists, which classifies
  // as `api` and would otherwise land on the generic "Something went wrong"
  // fallback — useless on a signup form, where the fix is to sign in instead.
  [ERROR_CODES.EMAIL_EXISTS]:
    "An account with this email already exists. Please sign in instead, or use a different email.",
  // Verification OTP. All three code failures are HTTP 400 -> `validation`, so
  // without curated copy they collapse into the same "details aren't valid"
  // fallback — which doesn't tell the user whether to retype or request a new code.
  [ERROR_CODES.VERIFY_CODE_INVALID]:
    "That code isn't correct. Check the 6 digits from your email and try again.",
  [ERROR_CODES.VERIFY_CODE_USED]: "That code has already been used. Request a new one.",
  [ERROR_CODES.VERIFY_CODE_EXPIRED]: "That code has expired. Request a new one.",
  // The guess budget for one code is spent; the code is retired, so "try again"
  // would be wrong advice — only a new code can work.
  [ERROR_CODES.VERIFY_ATTEMPTS_EXCEEDED]:
    "Too many incorrect attempts. Request a new code to continue.",
  [ERROR_CODES.VERIFY_USER_NOT_FOUND]: "We couldn't find that account. Please start again.",
  [ERROR_CODES.VERIFY_NO_EMAIL]: "This account has no email address to verify.",
  [ERROR_CODES.VERIFY_EMAIL_TAKEN]: "That email address is already in use by another account.",
  // Org creation is gated server-side on a verified email (tenant/http.go). It
  // arrives as 403 -> `authz`, whose fallback ("You don't have access to do
  // that") sends the user hunting for a permissions problem instead of telling
  // them the one thing that fixes it.
  [ERROR_CODES.VERIFY_EMAIL_NOT_VERIFIED]:
    "Please verify your email address first, then create your organization.",
  // 429 classifies as `api`; the resend button is throttled hard (anti-bombing),
  // so this is reachable from the OTP step by clicking "Resend code" repeatedly.
  [ERROR_CODES.TOO_MANY_REQUESTS]: "Too many attempts. Please wait a moment and try again.",
  [ERROR_CODES.HTTP_429]: "Too many attempts. Please wait a moment and try again.",
  // Sign-in. `auth.invalid_credentials` is a 401, so it inherited "Please sign
  // in again to continue." — which describes a session problem, not a typo in
  // the password, and sends the user looking in the wrong place entirely.
  [ERROR_CODES.INVALID_CREDENTIALS]: "Invalid email or password.",
  [ERROR_CODES.ACCOUNT_LOCKED]:
    "Too many failed attempts. Your account is temporarily locked — please try again later.",
  // Also a 401, and "sign in again" is actively wrong here: retrying cannot help.
  [ERROR_CODES.ACCOUNT_SUSPENDED]:
    "Your account is no longer active. Please contact your administrator.",
  [ERROR_CODES.ACCOUNT_INACTIVE]: "Your account isn't active. Contact your administrator.",
  [ERROR_CODES.SESSION_REVOKED]: "Your session was revoked. Please sign in again.",
  [ERROR_CODES.NOT_TENANT_MEMBER]: "You're not a member of this organization.",
  [ERROR_CODES.SELF_REGISTRATION_DISABLED]: "Self-registration isn't enabled for this application.",
  [ERROR_CODES.PASSWORD_WEAK]: "Choose a stronger password.",
  [ERROR_CODES.PASSWORD_BREACHED]:
    "This password has appeared in known data breaches. Please choose a different one.",
  [ERROR_CODES.PASSKEY_LOGIN_FAILED]:
    "We couldn't sign you in with that passkey. Try again, or use your password.",
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
