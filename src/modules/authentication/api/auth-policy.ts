// Tenant authentication-policy data layer: password complexity rules and which
// login methods are permitted. The whole policy is read and written as one
// object (PUT is a full replace), so each page loads it, edits its slice, and
// saves the merged result.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
export const AUTH_POLICY_KEY = ["auth-policy"] as const;

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

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
  // Hosted end-user self-registration (B2C signup). Full-replace PUT preserves
  // it even on pages that don't edit it.
  self_registration_enabled: boolean;
  // Adaptive MFA: allow skipping the second factor on a trusted device.
  remember_device_enabled: boolean;
  // Sign-in lockout: this many failed sign-ins to one account from one network,
  // each within the window of the last, lock it for that network for the
  // duration. null = the platform default (see lockout_limits). The server
  // refuses a value outside the bounds.
  lockout_threshold: number | null;
  lockout_window_minutes: number | null;
  lockout_duration_minutes: number | null;
  // Read-only: the platform defaults and the inclusive bounds for the three
  // settings above. Sent back unchanged by the full-replace PUT (ignored there).
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

export function useAuthPolicy() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: [...AUTH_POLICY_KEY, tenantId],
    enabled: !!tenantId,
    queryFn: () => api<AuthPolicy>(`/v1/tenants/${tenantId}/auth-policy`),
  });
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
    onSuccess: (data) => {
      qc.setQueryData([...AUTH_POLICY_KEY, tenantId], data);
      qc.invalidateQueries({ queryKey: AUTH_POLICY_KEY });
    },
    meta: { successMessage: "Authentication policy saved" },
  });
}
