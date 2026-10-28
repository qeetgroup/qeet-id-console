// The stable error codes the console branches on: backend `error.code`s plus a few the client
// synthesises. Give a flow a meaningful message by adding its code here and its copy in
// user-message.ts; anything unlisted gets the generic per-kind copy.

export type ErrorKind = "auth" | "authz" | "validation" | "network" | "api" | "unknown";

export const ERROR_CODES = {
  STEP_UP_REQUIRED: "step_up_required", // auth (session / step-up)
  SESSION_EXPIRED: "auth.session_expired",
  // Client-synthesised: Qeet ID was unreachable or overloaded (timeout, 5xx, 429). The refresh
  // token wasn't rejected, so the person stays signed in and can retry.
  SESSION_REFRESH_UNAVAILABLE: "client.session_refresh_unavailable",
  INVALID_STATE: "auth.invalid_state",
  EMAIL_EXISTS: "auth.email_exists", // sign-up
  // password reset links: each answers the reset page with a "send a new link" step
  RESET_LINK_INVALID: "recovery.reset_link_invalid",
  RECOVERY_LINK_USED: "recovery.link_used",
  RECOVERY_LINK_EXPIRED: "recovery.link_expired",
  // invitation links: a dead one says why; an existing account signs in to accept
  INVITE_LINK_INVALID: "invite.link_invalid",
  INVITE_INVALID: "invite.invalid",
  INVITE_EXPIRED: "invite.expired",
  INVITE_ACCOUNT_EXISTS: "invite.account_exists",
  INVITE_EMAIL_MISMATCH: "invite.email_mismatch",
  INVITE_EMAIL_NOT_VERIFIED: "invite.email_not_verified",
  // SAML single sign-on: the one-time code from /saml/acs, exchanged on /sso/callback
  SAML_LOGIN_CODE_INVALID: "saml.login_code_invalid",
  SAML_LOGIN_CODE_USED: "saml.login_code_used",
  SAML_LOGIN_CODE_EXPIRED: "saml.login_code_expired",
  // sign-in credentials and account state: several are 401s, whose `auth` fallback ("Please
  // sign in again") is wrong for each of them
  INVALID_CREDENTIALS: "auth.invalid_credentials",
  ACCOUNT_LOCKED: "auth.account_locked",
  SIGN_IN_UNAVAILABLE: "auth.sign_in_unavailable", // 503: lockout state unreadable, so fail closed
  ACCOUNT_SUSPENDED: "auth.account_suspended",
  ACCOUNT_INACTIVE: "auth.account_inactive",
  SESSION_REVOKED: "auth.session_revoked",
  SESSION_TIMED_OUT: "auth.session_timed_out", // 401 on renewal: past the maximum age or idle limit
  LAST_SIGN_IN_METHOD: "auth.last_sign_in_method", // 409: removing the last way to sign in
  SESSION_LIMIT: "auth.session_limit", // 403: past the organisation's limit on sessions
  ADDRESS_NOT_ALLOWED: "auth.address_not_allowed", // 403: the address rules refuse this network
  RULES_LOCK_OUT_CALLER: "risk.rules_lock_out_caller", // 409: the change would block the caller
  SOCIAL_PROVIDER_IN_USE: "social.provider_in_use", // 409: some people sign in only through it
  NOT_TENANT_MEMBER: "auth.not_tenant_member",
  SELF_REGISTRATION_DISABLED: "auth.self_registration_disabled",
  PASSWORD_WEAK: "auth.password_weak",
  PASSWORD_BREACHED: "auth.password_breached",
  // Password rules: every path that sets a password answers 422 with the rule that failed, and
  // the `validation` fallback names no rule.
  PASSWORD_TOO_SHORT: "authpolicy.password_too_short",
  PASSWORD_NO_UPPERCASE: "authpolicy.password_no_uppercase",
  PASSWORD_NO_NUMBER: "authpolicy.password_no_number",
  PASSWORD_NO_SYMBOL: "authpolicy.password_no_symbol",
  PASSWORD_POLICY_BREACHED: "authpolicy.password_breached",
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
  FORBIDDEN: "auth.forbidden", // authz
  ORG_SLUG_TAKEN: "tenant.slug_taken", // a reused name derives a slug already taken
  TENANT_OWNER_ONLY: "tenant.owner_only", // deleting an organisation, or calling it off
  TENANT_DELETION_SCHEDULED: "tenant.deletion_scheduled", // its deletion is already scheduled
  TENANT_DELETION_NOT_SCHEDULED: "tenant.deletion_not_scheduled", // nothing to call off
  GROUP_NAME_EXISTS: "group.name_exists", // a group's name is unique in its organisation
  GROUP_CYCLE: "group.cycle", // a group can't sit inside itself or its own groups
  GROUP_TEMPLATE_NAME_EXISTS: "group.template_name_exists", // a template's name is unique too
  BILLING_PLAN_LIMIT: "billing.plan_limit", // billing entitlements
  BILLING_UPGRADE_REQUIRED: "billing.upgrade_required",
  MFA_CODE_INVALID: "mfa.code_invalid", // mfa
  MFA_CODE_SEND_LIMITED: "mfa.code_send_limited",
  MFA_FACTOR_LIMIT: "mfa.factor_limit",
  MFA_DELIVERY_UNAVAILABLE: "mfa.delivery_unavailable",
  MFA_DELIVERY_FAILED: "mfa.delivery_failed",
  // a risky sign-in that cannot be confirmed (no second factor, no verified email)
  AUTH_RISK_VERIFICATION_UNAVAILABLE: "auth.risk_verification_unavailable",
  // Bulk user import: a whole batch refused. 422s, whose `validation` fallback names no fix.
  USER_IMPORT_EMPTY: "user.import_empty",
  USER_IMPORT_BATCH_TOO_LARGE: "user.import_batch_too_large",
  USER_IMPORT_FILE_TOO_LARGE: "user.import_file_too_large",
  USER_IMPORT_SOURCE_INVALID: "user.import_source_invalid",
  // Who manages an account: a whole-account change (status, password, two-step, deletion) is the
  // home organisation's; another one removes the person instead. 403/409s whose fallbacks name
  // no fix.
  USER_MANAGED_ELSEWHERE: "user.managed_elsewhere",
  USER_CREDENTIALS_SHARED: "user.credentials_shared",
  USER_MANAGED_HERE: "user.managed_here",
  USER_DOMAIN_MANAGED: "user.domain_managed_elsewhere",
  WEBHOOK_URL_REQUIRED: "webhook.url_required", // 422
  WEBHOOK_EVENTS_REQUIRED: "webhook.events_required", // 422
  WEBHOOK_EVENT_UNKNOWN: "webhook.event_unknown", // 422: not in the server's catalogue
  OIDC_GRANT_TYPE_UNSUPPORTED: "oidc.grant_type_unsupported", // 400: client_credentials, or unknown
  // Settings › Domains: 400 / 409 / 422s whose fallbacks don't say what to fix.
  DOMAIN_INVALID: "domainverify.invalid_domain",
  DOMAIN_EXISTS: "domainverify.exists",
  DOMAIN_RECORD_MISSING: "domainverify.dns_record_missing", // retryable: DNS can lag
  DOMAIN_CLAIMED_BY_OTHER: "domainverify.claimed_by_other",
  TOO_MANY_REQUESTS: "too_many_requests", // throttling
  HTTP_429: "http_429", // synthesised for a body-less 429, so it still reads as throttling
  NETWORK: "network_error", // client-synthesised
  UNKNOWN: "unknown_error",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES] | (string & {});
