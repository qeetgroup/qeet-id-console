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

import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { complianceKeys } from "./keys";

export type Framework = "soc2" | "iso27001";

/** A run of the framework's checks: `controls` comes with the detail read, not the list. */
export type EvidenceRun = Answer<"/v1/organizations/{organizationID}/compliance/evidence/{id}">;
/** One check: its `id` stays the same across runs, and `detail` says what was found. */
export type ControlResult = NonNullable<EvidenceRun["controls"]>[number];
export type ControlStatus = ControlResult["status"];

/** One run with its checks; shared by the run's view, the "since" lines and a download. */
export const evidenceRunQuery = (organizationId: string | null, runId: string | null) =>
  queryOptions({
    queryKey: complianceKeys.evidenceRun(organizationId, runId),
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/compliance/evidence/{id}", {
        path: { organizationID: organizationId ?? "", id: runId ?? "" },
      }),
    enabled: !!organizationId && !!runId,
    // A run never changes once generated.
    staleTime: Number.POSITIVE_INFINITY,
  });

/** The framework's runs, newest first (the server keeps the 100 newest), without controls. */
export function useEvidenceRuns(framework: Framework, enabled = true) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: complianceKeys.evidenceRuns(organizationId, framework),
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/compliance/{framework}/evidence", {
        path: { organizationID: organizationId ?? "", framework },
      }),
    enabled: !!organizationId && enabled,
  });
}

export function useEvidenceRun(runId: string | null) {
  return useQuery(evidenceRunQuery(useOrganizationId(), runId));
}

/** Several runs with their controls: how long each check has had its status. */
export function useEvidenceRunDetails(runIds: readonly string[]) {
  const organizationId = useOrganizationId();
  return useQueries({
    queries: runIds.map((id) => evidenceRunQuery(organizationId, id)),
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
  const organizationId = useOrganizationId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!organizationId) throw new Error("No tenant selected");
      return backend.post("/v1/organizations/{organizationID}/compliance/{framework}/evidence", {
        path: { organizationID: organizationId, framework },
      });
    },
    onSuccess: (run) => {
      qc.setQueryData(complianceKeys.evidenceRun(organizationId, run.id), run);
      void qc.invalidateQueries({
        queryKey: complianceKeys.evidenceRuns(organizationId, framework),
      });
    },
    meta: { successMessage: "compliance:toast.evidenceGenerated" },
  });
}
