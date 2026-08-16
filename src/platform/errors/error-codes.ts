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
  // authz
  FORBIDDEN: "auth.forbidden",
  // billing entitlements (surfaced as actionable upgrade prompts elsewhere)
  BILLING_PLAN_LIMIT: "billing.plan_limit",
  BILLING_UPGRADE_REQUIRED: "billing.upgrade_required",
  // mfa
  MFA_CODE_INVALID: "mfa.code_invalid",
  // client-synthesised
  NETWORK: "network_error",
  UNKNOWN: "unknown_error",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES] | (string & {});
