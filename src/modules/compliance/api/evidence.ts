// Compliance evidence: a run checks a framework's controls against the organization's
// configuration, and keeps the result.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { complianceKeys } from "./keys";

export type Framework = "soc2" | "iso27001";

export type ControlStatus = "pass" | "fail" | "na";

export type ControlResult = {
  id: string;
  name: string;
  category: string;
  criteria: string; // the framework's reference, e.g. "CC6.1" or "A.9.4"
  status: ControlStatus;
  detail: string; // what was found; never empty
};

export type EvidenceRun = {
  id: string;
  tenant_id: string;
  framework: string;
  generated_at: string;
  generated_by?: string | null;
  pass_count: number;
  fail_count: number;
  na_count: number;
  controls?: ControlResult[]; // sent by the detail endpoint, not the list
};

export function useEvidenceRuns(framework: Framework) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: complianceKeys.evidenceRuns(tenantId, framework),
    queryFn: () =>
      api<{ items: EvidenceRun[] }>(`/v1/tenants/${tenantId}/compliance/${framework}/evidence`),
    enabled: !!tenantId,
  });
}

export function useEvidenceRun(runId: string | null) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: complianceKeys.evidenceRun(tenantId, runId),
    queryFn: () => api<EvidenceRun>(`/v1/tenants/${tenantId}/compliance/evidence/${runId}`),
    enabled: !!tenantId && !!runId,
  });
}

/** Runs the framework's checks now; the answer carries the controls, so it seeds the run's view. */
export function useGenerateEvidence(framework: Framework) {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<EvidenceRun>(`/v1/tenants/${tenantId}/compliance/${framework}/evidence`, {
        method: "POST",
      });
    },
    onSuccess: (run) => {
      void qc.invalidateQueries({ queryKey: complianceKeys.evidenceRuns(tenantId, framework) });
      qc.setQueryData(complianceKeys.evidenceRun(tenantId, run.id), run);
    },
    meta: { successMessage: "compliance:toast.evidenceGenerated" },
  });
}
