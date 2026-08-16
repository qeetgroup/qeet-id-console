import { useMutation } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { ApiError } from "@/platform/errors/api-error";

// Step-up (recent-MFA) re-verification. Sensitive actions are gated server-side
// by RequireRecentMFA and return 403 `step_up_required` when the session hasn't
// verified a factor recently. `useStepUpVerify` re-verifies a TOTP/recovery code
// (refreshing that window) so the caller can retry. This is the cross-cutting
// gate paired with the platform step-up dialog and useSensitiveAction — the
// backend remains authoritative.
export function useStepUpVerify() {
  return useMutation({
    mutationFn: (code: string) =>
      api<{ verified: boolean }>("/v1/mfa/totp/verify", {
        method: "POST",
        body: { code },
      }),
    meta: { silent: true },
  });
}

/** True when an error is the backend's step-up-required signal. */
export function isStepUpRequired(err: unknown): boolean {
  return err instanceof ApiError && err.code === "step_up_required";
}
