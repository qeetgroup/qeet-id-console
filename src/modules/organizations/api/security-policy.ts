// The organisation's security policy (PUT replaces the whole object): session limits, who must use
// two-step verification, and what counts as a step-up. Its password_min_length and
// password_complexity are stored but enforced nowhere: the enforced password rules are the
// auth policy's (Sign-in › Password), so Settings › Security sends them back unchanged.

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";

import { orgKeys } from "./keys";

export type StepUpMethod = "totp" | "recovery_code" | "otp" | "webauthn" | "push";

/**
 * The organisation's security policy; `step_up_window` is a duration such as "5m", and
 * `step_up_methods` is null for "every factor counts".
 */
export type SecurityPolicy = Answer<"/v1/organizations/{organizationID}/policy">;

export const securityPolicyQueries = {
  get: (organizationId: string | null) =>
    queryOptions({
      queryKey: orgKeys.securityPolicy(organizationId),
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}/policy", {
          path: { organizationID: organizationId ?? "" },
        }),
      enabled: !!organizationId,
    }),
};

export function useSecurityPolicy() {
  return useQuery(securityPolicyQueries.get(useOrganizationId()));
}

export function useSaveSecurityPolicy() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SecurityPolicy) =>
      backend.put("/v1/organizations/{organizationID}/policy", {
        path: { organizationID: organizationId ?? "" },
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.securityPolicy(organizationId) }),
    meta: { successMessage: "organizations:toast.securityPolicySaved", silentError: true }, // the form shows it
  });
}
