// Steps within a sign-in's second-factor challenge. useCompleteMfaLogin completes the challenge
// at /v1/auth/mfa, and the BFF turns the result into the session.

import { startAuthentication } from "@simplewebauthn/browser";
import { z } from "zod";

import { strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import { ApiError } from "@/platform/api/client";
import type { Answer } from "@/platform/api/contract";
import { ERROR_CODES } from "@/platform/errors/error-codes";

import type { MfaProof } from "./flows";
import { requestOptions } from "./webauthn";

/** Sends a sign-in code to one of the challenged person's email or SMS factors. */
export function sendMfaCode(mfaToken: string, factorId: string): Promise<unknown> {
  return backend.post("/v1/auth/mfa/send", {
    body: { mfa_token: mfaToken, factor_id: factorId },
    anonymous: true,
  });
}

// The server always sends both; the document marks them optional.
const mfaPasskeyBegin = strictly<Answer<"/v1/auth/mfa/passkey/begin", "post">>()(
  z.object({ session_id: z.string().min(1), publicKey: z.record(z.string(), z.unknown()) }),
);

/** Runs the passkey assertion for the challenge and returns the proof to complete it with. */
export async function mfaPasskeyProof(mfaToken: string): Promise<MfaProof> {
  const begin = await backend.post("/v1/auth/mfa/passkey/begin", {
    body: { mfa_token: mfaToken },
    anonymous: true,
    schema: mfaPasskeyBegin,
  });
  const credential = await startAuthentication({ optionsJSON: requestOptions(begin.publicKey) });
  return { passkey: { session_id: begin.session_id, credential: { ...credential } } };
}

const mfaEnrollmentSchema = strictly<Answer<"/v1/auth/mfa/enroll", "post">>()(
  z.object({
    secret: z.string().min(1),
    provisioning_url: z.string().startsWith("otpauth://"),
  }),
);
/** An authenticator app being set up for an enrolment challenge. */
export type MfaEnrollment = z.infer<typeof mfaEnrollmentSchema>;

/** Starts the authenticator app that completes an enrolment challenge. */
export function startMfaEnrollment(mfaToken: string): Promise<MfaEnrollment> {
  return backend.post("/v1/auth/mfa/enroll", {
    body: { mfa_token: mfaToken },
    anonymous: true,
    schema: mfaEnrollmentSchema,
  });
}

const PUSH_POLL_MS = 2000;

// The server always sends both; the document marks them optional.
const pushRequestSchema = strictly<Answer<"/v1/auth/mfa/push", "post">>()(
  z.object({ expires_at: z.string().min(1), number: z.number().int() }),
);
/** A push approval request: the number the phone asks for, and when the request ends. */
export type PushRequest = z.infer<typeof pushRequestSchema>;

/** Sends a push approval request for the challenge to the person's phones. */
export function sendPushRequest(mfaToken: string): Promise<PushRequest> {
  return backend.post("/v1/auth/mfa/push", {
    body: { mfa_token: mfaToken },
    anonymous: true,
    schema: pushRequestSchema,
  });
}

/** Resolves true after ms, or false as soon as signal aborts. */
function pause(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const stop = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve(true);
    }, ms);
    signal.addEventListener("abort", stop, { once: true });
  });
}

/**
 * Completes the challenge once the push request is approved, asking every two seconds while it is
 * unanswered (which costs no attempt). Rejects with the server's error when it is denied or ends;
 * resolves false when signal aborts.
 */
export async function awaitPushApproval(mfaToken: string, signal: AbortSignal): Promise<boolean> {
  while (await pause(PUSH_POLL_MS, signal)) {
    try {
      await backend.post("/v1/auth/mfa", {
        body: { mfa_token: mfaToken, push: true },
        anonymous: true,
      });
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.code === ERROR_CODES.MFA_PUSH_PENDING)) throw err;
    }
  }
  return false;
}

/** How a push request that didn't complete ended: denied on the phone, unanswered, or failed. */
export function pushRequestOutcome(err: unknown): "denied" | "ended" | "failed" {
  if (!(err instanceof ApiError)) return "failed";
  // A denial, or a number that didn't match, reads as a wrong proof.
  if (err.code === ERROR_CODES.MFA_CODE_INVALID) return "denied";
  if (err.code === ERROR_CODES.MFA_PUSH_CHALLENGE_EXPIRED) return "ended";
  return "failed";
}
