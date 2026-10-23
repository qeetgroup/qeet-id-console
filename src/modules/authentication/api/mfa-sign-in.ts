// Steps within a sign-in's second-factor challenge. useCompleteMfaLogin completes the challenge
// at /v1/auth/mfa, and the BFF turns the result into the session.

import {
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
} from "@simplewebauthn/browser";

import { ApiError, api } from "@/platform/api/client";

import type { MfaProof } from "./flows";

/** Sends a sign-in code to one of the challenged person's email or SMS factors. */
export function sendMfaCode(mfaToken: string, factorId: string): Promise<unknown> {
  return api("/v1/auth/mfa/send", {
    method: "POST",
    body: { mfa_token: mfaToken, factor_id: factorId },
    anonymous: true,
  });
}

/** Runs the passkey assertion for the challenge and returns the proof to complete it with. */
export async function mfaPasskeyProof(mfaToken: string): Promise<MfaProof> {
  const begin = await api<{ session_id: string; publicKey: PublicKeyCredentialRequestOptionsJSON }>(
    "/v1/auth/mfa/passkey/begin",
    { method: "POST", body: { mfa_token: mfaToken }, anonymous: true },
  );
  const credential = await startAuthentication({ optionsJSON: begin.publicKey });
  return { passkey: { session_id: begin.session_id, credential } };
}

/** An authenticator app being set up for an enrolment challenge. */
export type MfaEnrollment = { secret: string; provisioning_url: string };

/** Starts the authenticator app that completes an enrolment challenge. */
export function startMfaEnrollment(mfaToken: string): Promise<MfaEnrollment> {
  return api<MfaEnrollment>("/v1/auth/mfa/enroll", {
    method: "POST",
    body: { mfa_token: mfaToken },
    anonymous: true,
  });
}

const PUSH_POLL_MS = 2000;

/**
 * Sends the push approval request and completes the challenge once it is approved, asking every
 * two seconds while it is unanswered (which costs no attempt). Rejects with the server's error
 * when it is denied or expires; resolves false when signal aborts.
 */
export async function completeWithPush(mfaToken: string, signal: AbortSignal): Promise<boolean> {
  await api("/v1/auth/mfa/push", {
    method: "POST",
    body: { mfa_token: mfaToken },
    anonymous: true,
  });
  while (!signal.aborted) {
    try {
      await api("/v1/auth/mfa", {
        method: "POST",
        body: { mfa_token: mfaToken, push: true },
        anonymous: true,
      });
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.code === "mfa.push_pending")) throw err;
    }
    await new Promise((r) => setTimeout(r, PUSH_POLL_MS));
  }
  return false;
}
