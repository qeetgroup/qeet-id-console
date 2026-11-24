// Adaptive sign-in risk: the score thresholds, when a risky sign-in must use MFA, and the
// impossible-travel and device-reputation signals.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

const RISK_PATH = "/v1/organizations/{organizationID}/security/risk-settings";

export type RiskSettings = Answer<typeof RISK_PATH>;

export function useRiskSettings() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.riskSettings(organizationId),
    queryFn: () =>
      backend.get(RISK_PATH, {
        path: { organizationID: organizationId ?? "" },
      }),
    enabled: !!organizationId,
  });
}

export function useUpdateRiskSettings() {
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiskSettings) =>
      backend.put(RISK_PATH, {
        path: { organizationID: organizationId ?? "" },
        body,
      }),
    onSuccess: (data) => qc.setQueryData(securityKeys.riskSettings(organizationId), data),
    meta: { successMessage: "security:toast.riskSettingsSaved", silentError: true }, // the page shows it
  });
}
