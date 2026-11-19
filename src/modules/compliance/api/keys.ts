// Every compliance query key sits under ["compliance", organizationId]; see src/modules/users/api/keys.ts.

export const complianceKeys = {
  all: ["compliance"] as const,
  organization: (organizationId: string | null) => ["compliance", organizationId] as const,
  retention: (organizationId: string | null) =>
    [...complianceKeys.organization(organizationId), "retention"] as const,
  // Who the saved window makes due now; a saved change or a removal refreshes it.
  retentionDue: (organizationId: string | null) =>
    [...complianceKeys.retention(organizationId), "due"] as const,
  gdprPurges: (organizationId: string | null) =>
    [...complianceKeys.organization(organizationId), "gdpr-purges"] as const,
  // A run's view sits under the evidence, which a new run refreshes.
  evidence: (organizationId: string | null) =>
    [...complianceKeys.organization(organizationId), "evidence"] as const,
  evidenceRuns: (organizationId: string | null, framework: string) =>
    [...complianceKeys.evidence(organizationId), "runs", framework] as const,
  evidenceRun: (organizationId: string | null, runId: string | null) =>
    [...complianceKeys.evidence(organizationId), "run", runId] as const,
};
