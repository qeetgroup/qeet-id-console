// The organisation's security policy (PUT replaces the whole object): session limits, who must use
// two-step verification, and what counts as a step-up. Its password_min_length and
// password_complexity are stored but enforced nowhere: the enforced password rules are the
// auth policy's (Sign-in › Password), so Settings › Security sends them back unchanged.

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { z } from "zod";

import { assured } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";

import { orgKeys } from "./keys";

export type StepUpMethod = "totp" | "recovery_code" | "otp" | "webauthn" | "push";

// What Settings › Security edits, always sent (securitypolicy.go) though the document leaves it
// optional. step_up_methods is null for "every factor counts", so it isn't held to being there.
const policySchema = assured<Answer<"/v1/organizations/{organizationID}/policy">>()(
  "session_max_age",
  "session_idle_timeout",
  "session_limit_action",
  "mfa_enforcement",
  "mfa_grace_days",
  "step_up_window",
);

/** The organisation's security policy; `step_up_window` is a duration such as "5m". */
export type SecurityPolicy = z.output<typeof policySchema>;

export const securityPolicyQueries = {
  get: (organizationId: string | null) =>
    queryOptions({
      queryKey: orgKeys.securityPolicy(organizationId),
      queryFn: () =>
        backend.get("/v1/organizations/{organizationID}/policy", {
          path: { organizationID: organizationId ?? "" },
          schema: policySchema,
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
