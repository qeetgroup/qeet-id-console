// What the sign-in endpoints answer: a server-owned session, or a second-factor challenge. Shared
// by every flow in flows.ts and its siblings.

export type SessionResponse = {
  token_type: string;
  expires_at: string;
  user_id: string;
  session_id: string;
  tenant_id?: string;
};

export type User = {
  id: string;
  tenant_id: string;
  email: string;
  display_name?: string | null;
  status: string;
};

/**
 * What /v1/auth/login returns instead of a session when the account holds, or must have, a
 * second factor; complete it at /v1/auth/mfa.
 */
export type MfaChallenge = {
  mfa_required: true;
  mfa_token: string;
  methods: string[];
  factors?: LoginFactor[]; // Exactly the second factors this person can complete the challenge with
  /**
   * The account must have a second factor and holds none: set up an authenticator app
   * (startMfaEnrollment) and complete with a code from it.
   */
  enrollment_required?: boolean;
  /** When the organisation's grace period ends; until then the setup can be skipped. */
  enrollment_due_at?: string;
};

/** One way to complete a sign-in's second-factor challenge. */
export type LoginFactor = {
  type: "totp" | "recovery_code" | "email" | "sms" | "passkey" | "push";
  id?: string; // An email or SMS factor's id, to send it a code
  destination?: string; // An email or SMS factor's masked address or number
};

/**
 * How a challenge is completed: a code, a passkey assertion, an approved push or, for an
 * enrolment challenge in its grace period, a skip.
 */
export type MfaProof =
  | { code: string }
  | { passkey: { session_id: string; credential: unknown } }
  | { push: true }
  | { skip: true };
export type LoginResponse = SessionResponse | MfaChallenge;

export function isMfaChallenge(r: LoginResponse): r is MfaChallenge {
  return "mfa_required" in r && r.mfa_required === true;
}
