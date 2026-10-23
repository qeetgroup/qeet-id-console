// Every compliance query key sits under ["compliance", tenantId]; see src/modules/users/api/keys.ts.

export const complianceKeys = {
  all: ["compliance"] as const,
  tenant: (tenantId: string | null) => ["compliance", tenantId] as const,
  retention: (tenantId: string | null) =>
    [...complianceKeys.tenant(tenantId), "retention"] as const,
  gdprPurges: (tenantId: string | null) =>
    [...complianceKeys.tenant(tenantId), "gdpr-purges"] as const,
  // A run's view sits under the evidence, which a new run refreshes.
  evidence: (tenantId: string | null) => [...complianceKeys.tenant(tenantId), "evidence"] as const,
  evidenceRuns: (tenantId: string | null, framework: string) =>
    [...complianceKeys.evidence(tenantId), "runs", framework] as const,
  evidenceRun: (tenantId: string | null, runId: string | null) =>
    [...complianceKeys.evidence(tenantId), "run", runId] as const,
};
