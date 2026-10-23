// Adaptive sign-in risk: the score thresholds, when a risky sign-in must use MFA, and the
// impossible-travel and device-reputation signals.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

export interface RiskSettings {
  medium_threshold: number;
  high_threshold: number;
  force_mfa_at_level: "medium" | "high";
  impossible_travel_enabled: boolean;
  min_travel_hours: number;
  device_reputation_enabled: boolean;
}

export function useRiskSettings() {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: securityKeys.riskSettings(tenantId),
    queryFn: () => api<RiskSettings>(`/v1/tenants/${tenantId}/security/risk-settings`),
    enabled: !!tenantId,
  });
}

export function useUpdateRiskSettings() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskSettings) =>
      api<RiskSettings>(`/v1/tenants/${tenantId}/security/risk-settings`, {
        method: "PUT",
        body,
      }),
    onSuccess: (data) => qc.setQueryData(securityKeys.riskSettings(tenantId), data),
    meta: { successMessage: "Risk settings saved", silentError: true }, // the page shows it
  });
}
