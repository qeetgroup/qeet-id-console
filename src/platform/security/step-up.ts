import {
  browserSupportsWebAuthn,
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
} from "@simplewebauthn/browser";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { backend } from "@/platform/api/backend";
import { ApiError } from "@/platform/errors/api-error";

// Step-up re-verification. A sensitive action answers 403 `step_up_required` until the session
// has recently confirmed a factor the organisation counts; these hooks confirm one so the action
// can be resent. The backend decides.

/** True when an error is the backend's step-up-required signal. */
export function isStepUpRequired(err: unknown): boolean {
  return err instanceof ApiError && err.code === "step_up_required";
}

/** An email or SMS factor the person can be sent a step-up code at. */
export type StepUpCodeFactor = { id: string; channel: "email" | "sms"; destination: string };

/** The ways the calling person can step up, given what the organisation counts. */
export type StepUpOptions = {
  passkey: boolean;
  authenticator: boolean;
  recoveryCode: boolean;
  codeFactors: StepUpCodeFactor[];
};

const totpStatusSchema = z.object({ enrolled: z.boolean() });
const codeFactorsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      channel: z.enum(["email", "sms"]),
      destination: z.string(), // masked
      verified: z.boolean(),
    }),
  ),
});
const passkeysSchema = z.object({ items: z.array(z.object({ id: z.string() })) });
// The server answers a met factor with exactly this; nothing else may count as stepped up.
const verifiedSchema = z.object({ verified: z.literal(true) });

function counts(allowed: string[] | null, ...methods: string[]): boolean {
  return allowed === null || methods.some((m) => allowed.includes(m));
}

/** Returns what the person can step up with, read when the dialog opens. */
export function useStepUpOptions(open: boolean, allowed: string[] | null) {
  return useQuery({
    queryKey: ["step-up", "options", allowed],
    enabled: open,
    staleTime: 0,
    queryFn: async (): Promise<StepUpOptions> => {
      const [totp, otp, passkeys] = await Promise.all([
        backend
          .get("/v1/mfa/totp", { schema: totpStatusSchema })
          .catch(() => ({ enrolled: false })),
        backend
          .get("/v1/mfa/otp/factors", { schema: codeFactorsSchema })
          .catch(() => ({ items: [] })),
        backend.get("/v1/passkeys", { schema: passkeysSchema }).catch(() => ({ items: [] })),
      ]);
      return {
        passkey:
          counts(allowed, "webauthn") && passkeys.items.length > 0 && browserSupportsWebAuthn(),
        authenticator: counts(allowed, "totp") && totp.enrolled,
        recoveryCode: counts(allowed, "recovery_code") && totp.enrolled,
        codeFactors: counts(allowed, "otp")
          ? otp.items
              .filter((f) => f.verified)
              .map(({ id, channel, destination }) => ({ id, channel, destination }))
          : [],
      };
    },
    meta: { silent: true },
  });
}

/**
 * Confirms an authenticator-app or recovery code (`authenticator`), or a code sent to an email or
 * SMS factor (`otp`).
 */
export function useStepUpVerify() {
  return useMutation({
    mutationFn: ({
      code,
      kind = "authenticator",
    }: {
      code: string;
      kind?: "authenticator" | "otp";
    }) =>
      kind === "otp"
        ? backend.post("/v1/mfa/otp/verify", { body: { code }, schema: verifiedSchema })
        : backend.post("/v1/mfa/totp/verify", { body: { code }, schema: verifiedSchema }),
    meta: { silent: true },
  });
}

/** Sends a step-up code to one of the person's email or SMS factors. */
export function useStepUpSendCode() {
  return useMutation({
    mutationFn: (factorId: string) =>
      backend.post("/v1/mfa/otp/factors/{id}/challenge", { path: { id: factorId } }),
    meta: { silent: true },
  });
}

/** Confirms one of the person's passkeys through the browser's passkey prompt. */
export function useStepUpPasskey() {
  return useMutation({
    mutationFn: async () => {
      const begin = await backend.post("/v1/mfa/webauthn/challenge");
      // The contract types the WebAuthn options loosely (its challenge is `unknown`); they are the
      // server's go-webauthn output, made for this browser call.
      const optionsJSON = begin.publicKey as PublicKeyCredentialRequestOptionsJSON;
      const credential = await startAuthentication({ optionsJSON });
      return backend.post("/v1/mfa/webauthn/verify", {
        body: { session_id: begin.session_id, credential },
        schema: verifiedSchema,
      });
    },
    meta: { silent: true },
  });
}
