// The tenant's authentication policy: password rules and permitted sign-in methods. PUT replaces
// the whole object, so each page loads it, edits its slice and saves the merged result. The server
// clamps the password length to 8–128 and the magic-link lifetime to 5–1440 minutes, and refuses a
// policy with no first-factor method on (password, passkey or magic link).

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { authKeys } from "./keys";

const lockoutSettings = z.object({
  threshold: z.number(),
  window_minutes: z.number(),
  duration_minutes: z.number(),
});
export type LockoutSettings = z.infer<typeof lockoutSettings>;

// The server always sends every field (internal/access/authpolicy/authpolicy.go); the document
// marks them optional. PUT replaces the whole policy, so a page saves only one it holds
// in full.
const policySchema = strictly<Answer<"/v1/organizations/{organizationID}/auth-policy">>()(
  z.object({
    password_enabled: z.boolean(),
    password_min_length: z.number(),
    password_require_uppercase: z.boolean(),
    password_require_number: z.boolean(),
    password_require_symbol: z.boolean(),
    magic_link_enabled: z.boolean(),
    magic_link_ttl_minutes: z.number(),
    passkey_enabled: z.boolean(),
    otp_email_enabled: z.boolean(),
    otp_sms_enabled: z.boolean(),
    self_registration_enabled: z.boolean(), // Hosted end-user self-registration (B2C sign-up)
    remember_device_enabled: z.boolean(), // Adaptive MFA: a trusted device may skip the second factor
    remember_device_days: z.number(), // 1–90; fixed for a device when it's remembered
    // Sign-in lockout: this many failed sign-ins to one account from one network, each within the
    // window of the last, lock it for that network for the duration. null: the platform default.
    // The server refuses a value outside lockout_limits.
    lockout_threshold: z.number().nullable(),
    lockout_window_minutes: z.number().nullable(),
    lockout_duration_minutes: z.number().nullable(),
    // Read-only platform defaults and inclusive bounds for the lockout settings; PUT ignores it.
    lockout_limits: z
      .object({ defaults: lockoutSettings, min: lockoutSettings, max: lockoutSettings })
      .optional(),
  }),
);
export type AuthPolicy = z.infer<typeof policySchema>;

export const authPolicyQueries = {
  detail: (organizationId: string | null) =>
    queryOptions({
      queryKey: authKeys.policy(organizationId),
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}/auth-policy", {
          path: { organizationID: organizationId ?? "" },
          schema: policySchema,
        }),
      enabled: !!organizationId,
    }),
};

export function useAuthPolicy() {
  return useQuery(authPolicyQueries.detail(useOrganizationId()));
}

export function useUpdateAuthPolicy() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AuthPolicy) =>
      backend.put("/v1/organizations/{organizationID}/auth-policy", {
        path: { organizationID: organizationId ?? "" },
        body,
        schema: policySchema,
      }),
    onSuccess: (data) => qc.setQueryData(authKeys.policy(organizationId), data), // PUT returns the whole policy
    meta: { successMessage: "authentication:toast.authenticationPolicySaved", silentError: true }, // pages show it
  });
}
