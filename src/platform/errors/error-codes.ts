// Central catalogue of the stable machine error codes the console reacts to.
// The backend `error.code` and a few client-synthesised codes flow through
// here so branching/localisation happens on one source instead of scattered
// string literals. Add a code here + copy in user-message.ts to give a flow a
// meaningful message; anything unlisted falls back to generic per-kind copy.

export type ErrorKind = "auth" | "authz" | "validation" | "network" | "api" | "unknown";

export const ERROR_CODES = {
  // auth (session / step-up)
  STEP_UP_REQUIRED: "step_up_required",
  SESSION_EXPIRED: "auth.session_expired",
  INVALID_STATE: "auth.invalid_state",
  // account / signup
  EMAIL_EXISTS: "auth.email_exists",
  // sign-in credentials + account state. Statuses come from the auth domain's
  // own table (error_status_auth.go), so several land on 401 -> `auth`, whose
  // fallback ("Please sign in again") is wrong for every one of them.
  INVALID_CREDENTIALS: "auth.invalid_credentials",
  ACCOUNT_LOCKED: "auth.account_locked",
  ACCOUNT_SUSPENDED: "auth.account_suspended",
  ACCOUNT_INACTIVE: "auth.account_inactive",
  SESSION_REVOKED: "auth.session_revoked",
  NOT_TENANT_MEMBER: "auth.not_tenant_member",
  SELF_REGISTRATION_DISABLED: "auth.self_registration_disabled",
  PASSWORD_WEAK: "auth.password_weak",
  PASSWORD_BREACHED: "auth.password_breached",
  PASSKEY_LOGIN_FAILED: "passkey.login_failed",
  // email / phone verification (signup OTP step, email-change flow)
  VERIFY_CODE_INVALID: "verification.code_invalid",
  VERIFY_CODE_USED: "verification.code_used",
  VERIFY_CODE_EXPIRED: "verification.code_expired",
  VERIFY_ATTEMPTS_EXCEEDED: "verification.attempts_exceeded",
  VERIFY_USER_NOT_FOUND: "verification.user_not_found",
  VERIFY_NO_EMAIL: "verification.no_email",
  VERIFY_EMAIL_TAKEN: "verification.email_taken",
  VERIFY_EMAIL_NOT_VERIFIED: "verification.email_not_verified",
  // authz
  FORBIDDEN: "auth.forbidden",
  // organization / tenant. Only `slug` is unique (uq_tenants_slug on
  // LOWER(slug)); org names are free to repeat. The console auto-derives the
  // slug from the name, so typing an existing org's name silently reuses its
  // slug and trips this on submit.
  ORG_SLUG_TAKEN: "tenant.slug_taken",
  // billing entitlements (surfaced as actionable upgrade prompts elsewhere)
  BILLING_PLAN_LIMIT: "billing.plan_limit",
  BILLING_UPGRADE_REQUIRED: "billing.upgrade_required",
  // mfa
  MFA_CODE_INVALID: "mfa.code_invalid",
  // throttling
  TOO_MANY_REQUESTS: "too_many_requests",
  // Synthesised by client.ts as `http_${status}` when a response carries no
  // error envelope at all. The rate limiters used to reject with a bare 429 and
  // an empty body, so this was the only code the console ever saw for a
  // throttled request. Kept as a safety net: any future body-less 429 still
  // reads as rate limiting rather than "Something went wrong".
  HTTP_429: "http_429",
  // client-synthesised
  NETWORK: "network_error",
  UNKNOWN: "unknown_error",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES] | (string & {});
