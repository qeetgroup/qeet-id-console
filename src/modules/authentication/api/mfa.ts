// The signed-in user's MFA factors. The server takes the user from the session, so paths carry
// no user or tenant id.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { authKeys } from "./keys";
import { strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";

const totpStatusSchema = z.object({
  enrolled: z.boolean(), // True once the account has a *confirmed* TOTP factor
});
export type TotpStatus = z.infer<typeof totpStatusSchema>;

/**
 * Returns whether TOTP is enrolled, so the screen can show it as active rather than re-offer
 * setup: restarting enrolment rotates the secret and would break a working factor.
 */
export function useTotpStatus() {
  return useQuery({
    queryKey: authKeys.totp(),
    queryFn: () => backend.get("/v1/mfa/totp", { schema: totpStatusSchema }),
  });
}

const totpEnrollmentSchema = strictly<Answer<"/v1/mfa/totp/enroll/start", "post">>()(
  z.object({
    secret: z.string().min(1),
    provisioning_url: z.string().startsWith("otpauth://"),
    replacing: z.boolean().optional(), // A confirmed app exists and works until this one is confirmed
  }),
);
export type TotpEnrollment = z.infer<typeof totpEnrollmentSchema>;

// Both confirming a new app and regenerating answer with a fresh set, shown once.
const recoveryCodesSchema = z.object({
  recovery_codes: z.array(z.string().min(1)),
  warning: z.string().optional(),
});
export type RecoveryCodes = z.infer<typeof recoveryCodesSchema>;

/**
 * Starts setting up an authenticator app and resolves with its secret. While a confirmed app is
 * held this needs a step-up, and the new app replaces it only once confirmed.
 */
export function startTotpEnrollment(): Promise<TotpEnrollment> {
  return backend.post("/v1/mfa/totp/enroll/start", { body: {}, schema: totpEnrollmentSchema });
}

/** Confirms the app being set up with a code from it; resolves with the new recovery codes. */
export function confirmTotpEnrollment(code: string): Promise<RecoveryCodes> {
  return backend.post("/v1/mfa/totp/enroll/confirm", {
    body: { code },
    schema: recoveryCodesSchema,
  });
}

/** Starts setting up an authenticator app; a replacement waits beside the confirmed one. */
export function useStartTotpEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0, // the response holds the new app's secret
    mutationFn: startTotpEnrollment,
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.totp() }),
    meta: { silent: true }, // the page shows a failure on its card
  });
}

/** Confirms the app being set up; resolves with recovery codes that are shown once. */
export function useConfirmTotpEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0, // the response holds the recovery codes
    mutationFn: confirmTotpEnrollment,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: authKeys.totp() });
      void qc.invalidateQueries({ queryKey: authKeys.recoveryCodes() });
    },
    meta: { successMessage: "authentication:toast.authenticatorOn", silentError: true },
  });
}

/** Removes the authenticator app and, with it, the recovery codes. */
export function useDisableTotp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => backend.delete("/v1/mfa/totp"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: authKeys.totp() });
      void qc.invalidateQueries({ queryKey: authKeys.recoveryCodes() });
    },
    meta: { successMessage: "authentication:toast.authenticatorOff" },
  });
}

export interface RecoveryStatus {
  enrolled: boolean;
  total: number;
  remaining: number;
}

export function useRecoveryStatus() {
  return useQuery({
    queryKey: authKeys.recoveryCodes(),
    queryFn: () => backend.get("/v1/mfa/recovery-codes"),
  });
}

export function useRegenerateRecoveryCodes() {
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0, // the response holds the new codes
    mutationFn: () =>
      backend.post("/v1/mfa/recovery-codes/regenerate", { schema: recoveryCodesSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.recoveryCodes() }),
    // The screen opens step-up on a 403 instead of a dead-end toast, and shows its own success
    // toast once the (possibly retried) call resolves.
    meta: { silent: true },
  });
}

// Step-up verification is a platform security gate, owned by @/platform/security.
export { isStepUpRequired, useStepUpVerify } from "@/platform/security/step-up";

const otpChannelSchema = z.enum(["email", "sms"]);
export type OtpChannel = z.infer<typeof otpChannelSchema>;

const otpFactorSchema = z.object({
  id: z.string(),
  channel: otpChannelSchema,
  destination: z.string(), // Masked for display
  verified: z.boolean(),
  created_at: z.string(),
});
export type OtpFactor = z.infer<typeof otpFactorSchema>;

const otpFactorListSchema = z.object({ items: z.array(otpFactorSchema) });

export function useOtpFactors() {
  return useQuery({
    queryKey: authKeys.otpFactors(),
    queryFn: () => backend.get("/v1/mfa/otp/factors", { schema: otpFactorListSchema }),
  });
}

export function useEnrollOtpStart() {
  return useMutation({
    mutationFn: (body: { channel: OtpChannel; destination: string }) =>
      backend.post("/v1/mfa/otp/factors", { body }),
    meta: { successMessage: "authentication:toast.verificationCodeSent", silentError: true }, // the sheet shows it
  });
}

export function useConfirmOtpFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) =>
      backend.post("/v1/mfa/otp/factors/{id}/confirm", { path: { id }, body: { code } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.otpFactors() }),
    meta: { successMessage: "authentication:toast.factorConfirmed", silentError: true },
  });
}

export function useChallengeOtpFactor() {
  return useMutation({
    mutationFn: (id: string) =>
      backend.post("/v1/mfa/otp/factors/{id}/challenge", { path: { id } }),
    meta: { successMessage: "authentication:toast.testCodeSent" },
  });
}

export function useDeleteOtpFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backend.delete("/v1/mfa/otp/factors/{id}", { path: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.otpFactors() }),
    meta: { successMessage: "authentication:toast.factorRemoved" },
  });
}
