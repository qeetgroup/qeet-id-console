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
import { z } from "zod";

import { strictly } from "@/platform/api/assured";
import { backend } from "@/platform/api/backend";
import type { Answer } from "@/platform/api/contract";
import { useOrganizationId } from "@/platform/auth/session";
import { complianceKeys } from "./keys";

export type Framework = "soc2" | "iso27001";

// The server always sends these (internal/operations/compliance/evidence.go); the document marks
// them optional.
const control = z.object({
  id: z.string(), // stable across runs, e.g. "CC6.1-MFA"
  name: z.string(),
  category: z.string(),
  criteria: z.string(), // the framework's reference, e.g. "CC6.1" or "A.9.4"
  status: z.enum(["pass", "fail", "na"]),
  detail: z.string(), // what was found; never empty
});
const run = z.object({
  id: z.string(),
  organization_id: z.string(),
  framework: z.string(),
  generated_at: z.string(),
  generated_by: z.string().nullish(),
  pass_count: z.number(),
  fail_count: z.number(),
  na_count: z.number(),
  controls: z.array(control).optional(), // sent by the detail endpoint, not the list
});
const oneRun =
  strictly<Answer<"/v1/organizations/{organizationID}/compliance/evidence/{id}">>()(run);
const runList = strictly<
  Answer<"/v1/organizations/{organizationID}/compliance/{framework}/evidence">
>()(z.object({ items: z.array(run), truncated: z.boolean().optional() }));
const generatedRun =
  strictly<Answer<"/v1/organizations/{organizationID}/compliance/{framework}/evidence", "post">>()(
    run,
  );

export type ControlResult = z.infer<typeof control>;
export type ControlStatus = ControlResult["status"];
export type EvidenceRun = z.infer<typeof run>;

/** One run with its checks; shared by the run's view, the "since" lines and a download. */
export const evidenceRunQuery = (organizationId: string | null, runId: string | null) =>
  queryOptions({
    queryKey: complianceKeys.evidenceRun(organizationId, runId),
    queryFn: () =>
      backend.get("/v1/organizations/{organizationID}/compliance/evidence/{id}", {
        path: { organizationID: organizationId ?? "", id: runId ?? "" },
        schema: oneRun,
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
        schema: runList,
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
        schema: generatedRun,
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
