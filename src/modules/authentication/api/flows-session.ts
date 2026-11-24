// What the sign-in endpoints answer: a server-owned session, or a second-factor challenge. Shared
// by every flow in flows.ts and its siblings.

import type { Schemas } from "@/platform/api/contract";

/** A sign-in's session as the browser sees it: the BFF keeps the two tokens in its cookie. */
export type SessionResponse = Omit<
  Schemas<"access">["TokenPair"],
  "access_token" | "refresh_token"
>;

/**
 * What /v1/auth/login returns instead of a session when the account holds, or must have, a
 * second factor; complete it at /v1/auth/mfa. `factors` are exactly the ones this person can use;
 * `enrollment_required` asks for an authenticator app to be set up, by `enrollment_due_at`.
 */
export type MfaChallenge = Schemas<"access">["MFAChallenge"];

/** One way to complete a sign-in's second-factor challenge: an email or SMS one has an id. */
export type LoginFactor = Schemas<"access">["LoginFactor"];

/**
 * How a challenge is completed: a code, a passkey assertion, an approved push or, for an
 * enrolment challenge in its grace period, a skip.
 */
export type MfaProof =
  | { code: string }
  | { passkey: { session_id: string; credential: Record<string, unknown> } }
  | { push: true }
  | { skip: true };
export type LoginResponse = SessionResponse | MfaChallenge;

export function isMfaChallenge(r: LoginResponse): r is MfaChallenge {
  return "mfa_required" in r && r.mfa_required === true;
}
