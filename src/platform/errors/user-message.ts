import i18n, { type TranslationKey } from "@/i18n";
import { type ErrorCode, ERROR_CODES, type ErrorKind } from "@/platform/errors/error-codes";
import { normalizeError } from "@/platform/errors/normalize-error";

// The leak stop: a backend `error.message` or `detail` can carry internal context, so the UI
// never renders it. Known codes map to curated copy, the rest to a safe message per kind.
// Each value is an `errors` catalogue key.
const CODE_MESSAGES: Record<string, TranslationKey> = {
  [ERROR_CODES.STEP_UP_REQUIRED]: "errors:code.stepUpRequired",
  [ERROR_CODES.SESSION_EXPIRED]: "errors:code.sessionExpired",
  [ERROR_CODES.SESSION_REFRESH_UNAVAILABLE]: "errors:code.sessionRefreshUnavailable",
  [ERROR_CODES.INVALID_STATE]: "errors:code.invalidState",
  // 409 -> `api`, whose generic fallback is useless on a sign-up form: the fix is to sign in.
  [ERROR_CODES.EMAIL_EXISTS]: "errors:code.emailExists",
  // All three are 400 -> `validation`, whose fallback doesn't say whether to retype the code or
  // request a new one.
  [ERROR_CODES.VERIFY_CODE_INVALID]: "errors:code.verifyCodeInvalid",
  [ERROR_CODES.VERIFY_CODE_USED]: "errors:code.verifyCodeUsed",
  [ERROR_CODES.VERIFY_CODE_EXPIRED]: "errors:code.verifyCodeExpired",
  // The code is retired after too many guesses, so only a new one can work.
  [ERROR_CODES.VERIFY_ATTEMPTS_EXCEEDED]: "errors:code.verifyAttemptsExceeded",
  [ERROR_CODES.VERIFY_USER_NOT_FOUND]: "errors:code.verifyUserNotFound",
  [ERROR_CODES.VERIFY_NO_EMAIL]: "errors:code.verifyNoEmail",
  [ERROR_CODES.VERIFY_EMAIL_TAKEN]: "errors:code.verifyEmailTaken",
  // Creating an organization needs a verified email. 403 -> `authz`, whose fallback sends the
  // person hunting for a missing permission.
  [ERROR_CODES.VERIFY_EMAIL_NOT_VERIFIED]: "errors:code.verifyEmailNotVerified",
  // A dead invitation link is a 400 or 410 -> `validation` or `api`, whose fallbacks read like a
  // fault in a form; each says why and what to do.
  [ERROR_CODES.INVITE_LINK_INVALID]: "errors:code.inviteLinkInvalid",
  [ERROR_CODES.INVITE_INVALID]: "errors:code.inviteInvalid",
  [ERROR_CODES.INVITE_EXPIRED]: "errors:code.inviteExpired",
  [ERROR_CODES.INVITE_ACCOUNT_EXISTS]: "errors:code.inviteAccountExists",
  [ERROR_CODES.INVITE_EMAIL_MISMATCH]: "errors:code.inviteEmailMismatch",
  [ERROR_CODES.INVITE_EMAIL_NOT_VERIFIED]: "errors:code.inviteEmailNotVerified",
  // A spent or stale SSO code: only signing in again gets a new one.
  [ERROR_CODES.SAML_LOGIN_CODE_INVALID]: "errors:code.samlLoginCodeInvalid",
  [ERROR_CODES.SAML_LOGIN_CODE_USED]: "errors:code.samlLoginCodeUsed",
  [ERROR_CODES.SAML_LOGIN_CODE_EXPIRED]: "errors:code.samlLoginCodeExpired",
  // 429 -> `api`; resending a code is throttled hard, so repeated "Resend code" clicks reach it.
  [ERROR_CODES.TOO_MANY_REQUESTS]: "errors:code.tooManyRequests",
  [ERROR_CODES.HTTP_429]: "errors:code.tooManyRequests",
  [ERROR_CODES.INVALID_CREDENTIALS]: "errors:code.invalidCredentials", // a 401, not a session problem
  [ERROR_CODES.ACCOUNT_LOCKED]: "errors:code.accountLocked",
  // 503 -> `api`, whose "Something went wrong" reads like a fault in the form.
  [ERROR_CODES.SIGN_IN_UNAVAILABLE]: "errors:code.signInUnavailable",
  // Also a 401, where "sign in again" is wrong: retrying can't help.
  [ERROR_CODES.ACCOUNT_SUSPENDED]: "errors:code.accountSuspended",
  [ERROR_CODES.ACCOUNT_INACTIVE]: "errors:code.accountInactive",
  [ERROR_CODES.SESSION_REVOKED]: "errors:code.sessionRevoked",
  [ERROR_CODES.SESSION_TIMED_OUT]: "errors:code.sessionTimedOut",
  [ERROR_CODES.SESSION_LIMIT]: "errors:code.sessionLimit",
  // 403 -> `authz`, whose fallback suggests a missing permission; the network is what's refused.
  [ERROR_CODES.ADDRESS_NOT_ALLOWED]: "errors:code.addressNotAllowed",
  // 409 -> `api`. Without a relay key the API sees this console server's address, so that is
  // what the rules must keep allowing.
  [ERROR_CODES.RULES_LOCK_OUT_CALLER]: "errors:code.rulesLockOutCaller",
  [ERROR_CODES.LAST_SIGN_IN_METHOD]: "errors:code.lastSignInMethod",
  [ERROR_CODES.SOCIAL_PROVIDER_IN_USE]: "errors:code.socialProviderInUse",
  [ERROR_CODES.NOT_TENANT_MEMBER]: "errors:code.notTenantMember",
  [ERROR_CODES.SELF_REGISTRATION_DISABLED]: "errors:code.selfRegistrationDisabled",
  [ERROR_CODES.PASSWORD_WEAK]: "errors:code.passwordWeak",
  [ERROR_CODES.PASSWORD_BREACHED]: "errors:code.passwordBreached",
  // The minimum length isn't in the error code, so the copy can't name it.
  [ERROR_CODES.PASSWORD_TOO_SHORT]: "errors:code.passwordTooShort",
  [ERROR_CODES.PASSWORD_NO_UPPERCASE]: "errors:code.passwordNoUppercase",
  [ERROR_CODES.PASSWORD_NO_NUMBER]: "errors:code.passwordNoNumber",
  [ERROR_CODES.PASSWORD_NO_SYMBOL]: "errors:code.passwordNoSymbol",
  [ERROR_CODES.PASSWORD_POLICY_BREACHED]: "errors:code.passwordBreached",
  [ERROR_CODES.PASSKEY_LOGIN_FAILED]: "errors:code.passkeyLoginFailed",
  [ERROR_CODES.FORBIDDEN]: "errors:kind.authz",
  // 409 -> `api`, and a retry resubmits the same slug, so point at the field that fixes it: the
  // slug, not the name (names aren't unique).
  [ERROR_CODES.ORG_SLUG_TAKEN]: "errors:code.orgSlugTaken",
  [ERROR_CODES.MFA_CODE_INVALID]: "errors:code.mfaCodeInvalid",
  [ERROR_CODES.MFA_CODE_SEND_LIMITED]: "errors:code.mfaCodeSendLimited",
  [ERROR_CODES.MFA_FACTOR_LIMIT]: "errors:code.mfaFactorLimit",
  [ERROR_CODES.MFA_DELIVERY_UNAVAILABLE]: "errors:code.mfaDeliveryUnavailable",
  [ERROR_CODES.MFA_DELIVERY_FAILED]: "errors:code.mfaDeliveryFailed",
  [ERROR_CODES.AUTH_RISK_VERIFICATION_UNAVAILABLE]: "errors:code.authRiskVerificationUnavailable",
  [ERROR_CODES.BILLING_PLAN_LIMIT]: "errors:code.billingPlanLimit",
  [ERROR_CODES.BILLING_UPGRADE_REQUIRED]: "errors:code.billingUpgradeRequired",
  [ERROR_CODES.USER_IMPORT_EMPTY]: "errors:code.userImportEmpty",
  [ERROR_CODES.USER_IMPORT_BATCH_TOO_LARGE]: "errors:code.userImportBatchTooLarge",
  [ERROR_CODES.USER_IMPORT_FILE_TOO_LARGE]: "errors:code.userImportFileTooLarge",
  [ERROR_CODES.USER_IMPORT_SOURCE_INVALID]: "errors:code.userImportSourceInvalid",
  [ERROR_CODES.WEBHOOK_URL_REQUIRED]: "errors:code.webhookUrlRequired",
  [ERROR_CODES.WEBHOOK_EVENTS_REQUIRED]: "errors:code.webhookEventsRequired",
  // The list comes from the server's catalogue, so a refusal means it changed since it loaded.
  [ERROR_CODES.WEBHOOK_EVENT_UNKNOWN]: "errors:code.webhookEventUnknown",
  // 400 -> `validation`, which doesn't say which value or what to use instead.
  [ERROR_CODES.OIDC_GRANT_TYPE_UNSUPPORTED]: "errors:code.oidcGrantTypeUnsupported",
  [ERROR_CODES.NETWORK]: "errors:kind.network",
};

const KIND_FALLBACK: Record<ErrorKind, TranslationKey> = {
  auth: "errors:kind.auth",
  authz: "errors:kind.authz",
  validation: "errors:kind.validation",
  network: "errors:kind.network",
  api: "errors:kind.api",
  unknown: "errors:kind.api",
};

/** Returns user-safe copy for a code, or the kind's fallback; never the backend message. */
export function userMessageForCode(code: ErrorCode, kind: ErrorKind): string {
  return i18n.t(CODE_MESSAGES[code] ?? KIND_FALLBACK[kind]);
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
const FIELD_MESSAGES: Record<string, TranslationKey> = {
  required: "errors:field.required",
  invalid_email: "errors:field.invalidEmail",
  too_short: "errors:field.tooShort",
  too_long: "errors:field.tooLong",
  invalid_url: "errors:field.invalidUrl",
  invalid_phone: "errors:field.invalidPhone",
  invalid_uuid: "errors:field.invalidUuid",
  not_allowed: "errors:field.notAllowed",
  out_of_range: "errors:field.outOfRange",
};

/** Returns user-safe copy for a field's validation code; never the backend's own text. */
export function fieldMessageForCode(code: string): string {
  return i18n.t(FIELD_MESSAGES[code] ?? "errors:field.invalid");
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
