// Compliance evidence: a run checks a framework's controls against the organisation's live
// configuration and audit log, and keeps the result as it was. Readiness evidence for an auditor,
// not an audit: the server stores no external report or certificate.

import {
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { complianceKeys } from "./keys";

export type Framework = "soc2" | "iso27001";

export type ControlStatus = "pass" | "fail" | "na";

export type ControlResult = {
  id: string; // stable across runs, e.g. "CC6.1-MFA"
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

/** One run with its checks; shared by the run's view, the "since" lines and a download. */
export const evidenceRunQuery = (tenantId: string | null, runId: string | null) =>
  queryOptions({
    queryKey: complianceKeys.evidenceRun(tenantId, runId),
    queryFn: () => api<EvidenceRun>(`/v1/tenants/${tenantId}/compliance/evidence/${runId}`),
    enabled: !!tenantId && !!runId,
    // A run never changes once generated.
    staleTime: Number.POSITIVE_INFINITY,
  });

/** The framework's runs, newest first (the server keeps the 100 newest), without controls. */
export function useEvidenceRuns(framework: Framework, enabled = true) {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: complianceKeys.evidenceRuns(tenantId, framework),
    queryFn: () =>
      api<{ items: EvidenceRun[] }>(`/v1/tenants/${tenantId}/compliance/${framework}/evidence`),
    enabled: !!tenantId && enabled,
  });
}

export function useEvidenceRun(runId: string | null) {
  return useQuery(evidenceRunQuery(useTenantId(), runId));
}

/** Several runs with their controls: how long each check has had its status. */
export function useEvidenceRunDetails(runIds: readonly string[]) {
  const tenantId = useTenantId();
  return useQueries({
    queries: runIds.map((id) => evidenceRunQuery(tenantId, id)),
    combine: (results) => ({
      runs: results.map((r) => r.data),
      loading: results.some((r) => r.isLoading),
      // The first is the run on show; the rest only add "since" lines.
      error: results[0]?.error ?? null,
      retry: () => void results[0]?.refetch(),
    }),
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
      qc.setQueryData(complianceKeys.evidenceRun(tenantId, run.id), run);
      void qc.invalidateQueries({ queryKey: complianceKeys.evidenceRuns(tenantId, framework) });
    },
    meta: { successMessage: "compliance:toast.evidenceGenerated" },
  });
}
