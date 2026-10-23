import { type ErrorCode, ERROR_CODES, type ErrorKind } from "@/platform/errors/error-codes";
import { normalizeError } from "@/platform/errors/normalize-error";

// The leak stop: a backend `error.message` or `detail` can carry internal context, so the UI
// never renders it. Known codes map to curated copy, the rest to a safe message per kind.
// The copy is English only.
const CODE_MESSAGES: Record<string, string> = {
  [ERROR_CODES.STEP_UP_REQUIRED]: "This action needs a fresh identity check.",
  [ERROR_CODES.SESSION_EXPIRED]: "Your session has expired. Please sign in again.",
  [ERROR_CODES.SESSION_REFRESH_UNAVAILABLE]:
    "Qeet ID can't be reached right now. You're still signed in; please try again in a moment.",
  [ERROR_CODES.INVALID_STATE]: "That sign-in link is no longer valid. Please start again.",
  // 409 -> `api`, whose generic fallback is useless on a sign-up form: the fix is to sign in.
  [ERROR_CODES.EMAIL_EXISTS]:
    "An account with this email already exists. Please sign in instead, or use a different email.",
  // All three are 400 -> `validation`, whose fallback doesn't say whether to retype the code or
  // request a new one.
  [ERROR_CODES.VERIFY_CODE_INVALID]:
    "That code isn't correct. Check the 6 digits from your email and try again.",
  [ERROR_CODES.VERIFY_CODE_USED]: "That code has already been used. Request a new one.",
  [ERROR_CODES.VERIFY_CODE_EXPIRED]: "That code has expired. Request a new one.",
  // The code is retired after too many guesses, so only a new one can work.
  [ERROR_CODES.VERIFY_ATTEMPTS_EXCEEDED]:
    "Too many incorrect attempts. Request a new code to continue.",
  [ERROR_CODES.VERIFY_USER_NOT_FOUND]: "We couldn't find that account. Please start again.",
  [ERROR_CODES.VERIFY_NO_EMAIL]: "This account has no email address to verify.",
  [ERROR_CODES.VERIFY_EMAIL_TAKEN]: "That email address is already in use by another account.",
  // Creating an organization needs a verified email. 403 -> `authz`, whose fallback sends the
  // person hunting for a missing permission.
  [ERROR_CODES.VERIFY_EMAIL_NOT_VERIFIED]:
    "Please verify your email address first, then create your organization.",
  // 429 -> `api`; resending a code is throttled hard, so repeated "Resend code" clicks reach it.
  [ERROR_CODES.TOO_MANY_REQUESTS]: "Too many attempts. Please wait a moment and try again.",
  [ERROR_CODES.HTTP_429]: "Too many attempts. Please wait a moment and try again.",
  [ERROR_CODES.INVALID_CREDENTIALS]: "Invalid email or password.", // a 401, not a session problem
  [ERROR_CODES.ACCOUNT_LOCKED]:
    "Too many failed attempts. Your account is temporarily locked — please try again later.",
  // 503 -> `api`, whose "Something went wrong" reads like a fault in the form.
  [ERROR_CODES.SIGN_IN_UNAVAILABLE]:
    "Sign-in is temporarily unavailable. Please try again in a moment.",
  // Also a 401, where "sign in again" is wrong: retrying can't help.
  [ERROR_CODES.ACCOUNT_SUSPENDED]:
    "Your account is no longer active. Please contact your administrator.",
  [ERROR_CODES.ACCOUNT_INACTIVE]: "Your account isn't active. Contact your administrator.",
  [ERROR_CODES.SESSION_REVOKED]: "Your session was revoked. Please sign in again.",
  [ERROR_CODES.SESSION_TIMED_OUT]: "Your session has timed out. Please sign in again.",
  [ERROR_CODES.SESSION_LIMIT]:
    "You're signed in on too many devices for this organisation. Sign out of one of them, then try again.",
  // 403 -> `authz`, whose fallback suggests a missing permission; the network is what's refused.
  [ERROR_CODES.ADDRESS_NOT_ALLOWED]:
    "Your organisation doesn't allow sign-in from this network. Contact your administrator.",
  // 409 -> `api`. Without a relay key the API sees this console server's address, so that is
  // what the rules must keep allowing.
  [ERROR_CODES.RULES_LOCK_OUT_CALLER]:
    "This change would block the address you're working from and lock you out. Add an allow rule that covers it first.",
  [ERROR_CODES.LAST_SIGN_IN_METHOD]:
    "This is your only way to sign in. Add a passkey or set a password before removing it.",
  [ERROR_CODES.SOCIAL_PROVIDER_IN_USE]:
    "Some people can sign in only with this provider. Switch it off instead, or give them another way to sign in first.",
  [ERROR_CODES.NOT_TENANT_MEMBER]: "You're not a member of this organization.",
  [ERROR_CODES.SELF_REGISTRATION_DISABLED]: "Self-registration isn't enabled for this application.",
  [ERROR_CODES.PASSWORD_WEAK]: "Choose a stronger password.",
  [ERROR_CODES.PASSWORD_BREACHED]:
    "This password has appeared in known data breaches. Please choose a different one.",
  // The minimum length isn't in the error code, so the copy can't name it.
  [ERROR_CODES.PASSWORD_TOO_SHORT]: "Your password is too short. Please choose a longer one.",
  [ERROR_CODES.PASSWORD_NO_UPPERCASE]: "Your password must contain an uppercase letter.",
  [ERROR_CODES.PASSWORD_NO_NUMBER]: "Your password must contain a number.",
  [ERROR_CODES.PASSWORD_NO_SYMBOL]: "Your password must contain a symbol.",
  [ERROR_CODES.PASSWORD_POLICY_BREACHED]:
    "This password has appeared in known data breaches. Please choose a different one.",
  [ERROR_CODES.PASSKEY_LOGIN_FAILED]:
    "We couldn't sign you in with that passkey. Try again, or use your password.",
  [ERROR_CODES.FORBIDDEN]: "You don't have access to do that.",
  // 409 -> `api`, and a retry resubmits the same slug, so point at the field that fixes it: the
  // slug, not the name (names aren't unique).
  [ERROR_CODES.ORG_SLUG_TAKEN]:
    "That organization URL is already taken. Choose a different URL — your organization name can stay the same.",
  [ERROR_CODES.MFA_CODE_INVALID]: "That code isn't valid. Check your authenticator and try again.",
  [ERROR_CODES.MFA_CODE_SEND_LIMITED]:
    "A code was sent recently. Wait a moment before asking for another.",
  [ERROR_CODES.MFA_FACTOR_LIMIT]:
    "You've set up as many email and SMS codes as an account can have. Remove one to add another.",
  [ERROR_CODES.MFA_DELIVERY_UNAVAILABLE]:
    "Codes can't be sent this way right now. Use another way to verify.",
  [ERROR_CODES.MFA_DELIVERY_FAILED]:
    "We couldn't send your code. Try again in a moment, or use another way to verify.",
  [ERROR_CODES.AUTH_RISK_VERIFICATION_UNAVAILABLE]:
    "We couldn't confirm this sign-in. Ask your administrator for help.",
  [ERROR_CODES.BILLING_PLAN_LIMIT]: "You've reached your plan's limit.",
  [ERROR_CODES.BILLING_UPGRADE_REQUIRED]: "This feature isn't included in your plan.",
  [ERROR_CODES.USER_IMPORT_EMPTY]: "The file has no users to import.",
  [ERROR_CODES.USER_IMPORT_BATCH_TOO_LARGE]:
    "An import can add at most 1,000 users. Split the file and import each part.",
  [ERROR_CODES.USER_IMPORT_FILE_TOO_LARGE]:
    "That file is too large to import. The maximum is 10 MB.",
  [ERROR_CODES.USER_IMPORT_SOURCE_INVALID]: "This export format isn't supported.",
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

/** Returns user-safe copy for a code, or the kind's fallback; never the backend message. */
export function userMessageForCode(code: ErrorCode, kind: ErrorKind): string {
  return CODE_MESSAGES[code] ?? KIND_FALLBACK[kind];
}

/**
 * Returns the user-safe message for any thrown value. Use it wherever an error is shown inline:
 * `error.message` can leak backend detail.
 */
export function errorMessage(err: unknown): string {
  const app = normalizeError(err);
  return userMessageForCode(app.code, app.kind);
}

// Per-field copy for the codes the backend's request validation uses.
const FIELD_MESSAGES: Record<string, string> = {
  required: "This field is required.",
  invalid_email: "Enter a valid email address.",
  too_short: "This is too short.",
  too_long: "This is too long.",
  invalid_url: "Enter a valid URL.",
  invalid_phone: "Enter a valid phone number, including the country code.",
  invalid_uuid: "This isn't a valid identifier.",
  not_allowed: "Choose one of the allowed values.",
  out_of_range: "This value is out of range.",
};

/** Returns user-safe copy for a field's validation code; never the backend's own text. */
export function fieldMessageForCode(code: string): string {
  return FIELD_MESSAGES[code] ?? "This value isn't valid.";
}

/** Returns copy for each field a 422 rejected, keyed by the request body's JSON name. */
export function fieldErrorMessages(err: unknown): Record<string, string> {
  const messages: Record<string, string> = {};
  for (const { field, code } of normalizeError(err).fields) {
    messages[field] ??= fieldMessageForCode(code);
  }
  return messages;
}

/** Returns the failed request's id, for the person to quote to support. */
export function errorReference(err: unknown): string | undefined {
  return normalizeError(err).requestId;
}
