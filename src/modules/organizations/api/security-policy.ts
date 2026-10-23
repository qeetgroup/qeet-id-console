// The organization's security policy: password rules, session limits, MFA enforcement and what
// counts as a step-up.

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import { orgKeys } from "./keys";

export type StepUpMethod = "totp" | "recovery_code" | "otp" | "webauthn" | "push";

export interface SecurityPolicy {
  tenant_id: string;
  password_min_length: number;
  password_complexity: string;
  session_max_age: string;
  session_idle_timeout: string;
  max_sessions: number | null;
  session_limit_action: string;
  mfa_enforcement: string;
  mfa_grace_days: number;
  mfa_enforced_since?: string | null; // read-only: when it was turned on; null while optional
  step_up_window: string; // how long a step-up unlocks sensitive actions, e.g. "5m"
  step_up_methods: StepUpMethod[] | null; // factor types that count as a step-up; null = all
  settings?: Record<string, unknown> | null;
}

export const securityPolicyQueries = {
  get: (tenantId: string | null) =>
    queryOptions({
      queryKey: orgKeys.securityPolicy(tenantId),
      queryFn: () => api<SecurityPolicy>(`/v1/tenants/${tenantId}/policy`),
      enabled: !!tenantId,
    }),
};

export function useSecurityPolicy() {
  return useQuery(securityPolicyQueries.get(useTenantId()));
}

export function useSaveSecurityPolicy() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SecurityPolicy) =>
      api<SecurityPolicy>(`/v1/tenants/${tenantId}/policy`, { method: "PUT", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.securityPolicy(tenantId) }),
    meta: { successMessage: "Security policy saved", silentError: true }, // the form shows it
  });
}
