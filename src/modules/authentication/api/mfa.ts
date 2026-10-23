// The signed-in user's MFA factors. The server takes the user from the session, so paths carry
// no user or tenant id.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";

export interface TotpStatus {
  enrolled: boolean; // True once the account has a *confirmed* TOTP factor
}

/**
 * Returns whether TOTP is enrolled, so the screen can show it as active rather than re-offer
 * setup: restarting enrolment rotates the secret and would break a working factor.
 */
export function useTotpStatus() {
  return useQuery({
    queryKey: ["mfa", "totp"],
    queryFn: () => api<TotpStatus>("/v1/mfa/totp"),
  });
}

export interface RecoveryStatus {
  enrolled: boolean;
  total: number;
  remaining: number;
}

export function useRecoveryStatus() {
  return useQuery({
    queryKey: ["mfa", "recovery-codes"],
    queryFn: () => api<RecoveryStatus>("/v1/mfa/recovery-codes"),
  });
}

export function useRegenerateRecoveryCodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ recovery_codes: string[]; warning: string }>("/v1/mfa/recovery-codes/regenerate", {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mfa", "recovery-codes"] }),
    // The screen opens step-up on a 403 instead of a dead-end toast, and shows its own success
    // toast once the (possibly retried) call resolves.
    meta: { silent: true },
  });
}

// Step-up verification is a platform security gate, owned by @/platform/security.
export { isStepUpRequired, useStepUpVerify } from "@/platform/security/step-up";

export type OtpChannel = "email" | "sms";

export interface OtpFactor {
  id: string;
  channel: OtpChannel;
  destination: string; // Masked for display
  verified: boolean;
  created_at: string;
}

export function useOtpFactors() {
  return useQuery({
    queryKey: ["mfa", "otp-factors"],
    queryFn: () => api<{ items: OtpFactor[] }>("/v1/mfa/otp/factors"),
  });
}

export function useEnrollOtpStart() {
  return useMutation({
    mutationFn: (body: { channel: OtpChannel; destination: string }) =>
      api<{ factor_id: string; message: string }>("/v1/mfa/otp/factors", {
        method: "POST",
        body,
      }),
    meta: { successMessage: "Verification code sent" },
  });
}

export function useConfirmOtpFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) =>
      api<{ verified: boolean }>(`/v1/mfa/otp/factors/${id}/confirm`, {
        method: "POST",
        body: { code },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mfa", "otp-factors"] }),
    meta: { successMessage: "Factor confirmed" },
  });
}

export function useChallengeOtpFactor() {
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/v1/mfa/otp/factors/${id}/challenge`, {
        method: "POST",
      }),
    meta: { successMessage: "Test code sent" },
  });
}

export function useDeleteOtpFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/v1/mfa/otp/factors/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mfa", "otp-factors"] }),
    meta: { successMessage: "Factor removed" },
  });
}
