// The tenant's authentication policy: password rules and permitted sign-in methods. PUT replaces
// the whole object, so each page loads it, edits its slice and saves the merged result. The server
// clamps the password length to 8–128 and the magic-link lifetime to 5–1440 minutes, and refuses a
// policy with no first-factor method on (password, passkey or magic link).

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { authKeys } from "./keys";

export interface AuthPolicy {
  password_enabled: boolean;
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_number: boolean;
  password_require_symbol: boolean;
  magic_link_enabled: boolean;
  magic_link_ttl_minutes: number;
  passkey_enabled: boolean;
  otp_email_enabled: boolean;
  otp_sms_enabled: boolean;
  self_registration_enabled: boolean; // Hosted end-user self-registration (B2C sign-up)
  remember_device_enabled: boolean; // Adaptive MFA: a trusted device may skip the second factor
  remember_device_days: number; // How long a device stays remembered, 1–90; fixed when it's remembered
  /**
   * Sign-in lockout: this many failed sign-ins to one account from one network, each within the
   * window of the last, lock it for that network for the duration. null: the platform default.
   * The server refuses a value outside lockout_limits.
   */
  lockout_threshold: number | null;
  lockout_window_minutes: number | null;
  lockout_duration_minutes: number | null;
  /** Read-only platform defaults and inclusive bounds for the lockout settings; PUT ignores it. */
  lockout_limits?: LockoutLimits;
}

export interface LockoutSettings {
  threshold: number;
  window_minutes: number;
  duration_minutes: number;
}

export interface LockoutLimits {
  defaults: LockoutSettings;
  min: LockoutSettings;
  max: LockoutSettings;
}

export const authPolicyQueries = {
  detail: (tenantId: string | null) =>
    queryOptions({
      queryKey: authKeys.policy(tenantId),
      queryFn: () => api<AuthPolicy>(`/v1/tenants/${tenantId}/auth-policy`),
      enabled: !!tenantId,
    }),
};

export function useAuthPolicy() {
  return useQuery(authPolicyQueries.detail(useTenantId()));
}

export function useUpdateAuthPolicy() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AuthPolicy) =>
      api<AuthPolicy>(`/v1/tenants/${tenantId}/auth-policy`, {
        method: "PUT",
        body,
      }),
    onSuccess: (data) => qc.setQueryData(authKeys.policy(tenantId), data), // PUT returns the whole policy
    meta: { successMessage: "authentication:toast.authenticationPolicySaved", silentError: true }, // pages show it
  });
}
