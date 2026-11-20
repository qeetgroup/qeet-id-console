// Adaptive sign-in risk: the score thresholds, when a risky sign-in must use MFA, and the
// impossible-travel and device-reputation signals.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";

import { assured } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { securityKeys } from "./keys";

const RISK_PATH = "/v1/organizations/{organizationID}/security/risk-settings";

// The server always sends these (internal/access/threat/risk/risk.go); the document marks them
// optional. PUT takes them all.
const riskSchema = assured<Answer<typeof RISK_PATH>>()(
  "medium_threshold",
  "high_threshold",
  "force_mfa_at_level",
  "impossible_travel_enabled",
  "min_travel_hours",
  "device_reputation_enabled",
);
export type RiskSettings = z.infer<typeof riskSchema>;

export function useRiskSettings() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: securityKeys.riskSettings(organizationId),
    queryFn: () =>
      backend.get(RISK_PATH, {
        path: { organizationID: organizationId ?? "" },
        schema: riskSchema,
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
        schema: riskSchema,
      }),
    onSuccess: (data) => qc.setQueryData(securityKeys.riskSettings(organizationId), data),
    meta: { successMessage: "security:toast.riskSettingsSaved", silentError: true }, // the page shows it
  });
}
