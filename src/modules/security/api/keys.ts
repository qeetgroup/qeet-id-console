// Every security query key sits under ["security", organizationId]; see src/modules/users/api/keys.ts.

export const securityKeys = {
  all: ["security"] as const,
  organization: (organizationId: string | null) => ["security", organizationId] as const,
  anomalies: (organizationId: string | null) =>
    [...securityKeys.organization(organizationId), "anomalies"] as const,
  anomalyList: (organizationId: string | null) =>
    [...securityKeys.anomalies(organizationId), "list"] as const,
  anomalySummary: (organizationId: string | null) =>
    [...securityKeys.anomalies(organizationId), "summary"] as const,
  auditAnomalies: (organizationId: string | null) =>
    [...securityKeys.organization(organizationId), "audit-anomalies"] as const,
  auditAnomalyList: (organizationId: string | null, status: string) =>
    [...securityKeys.auditAnomalies(organizationId), "list", status] as const,
  auditAnomalySummary: (organizationId: string | null) =>
    [...securityKeys.auditAnomalies(organizationId), "summary"] as const,
  auditAnomalySettings: (organizationId: string | null) =>
    [...securityKeys.auditAnomalies(organizationId), "settings"] as const,
  auditLog: (organizationId: string | null, filters: object, cursor: string | undefined) =>
    [...securityKeys.organization(organizationId), "audit-log", filters, cursor] as const,
  auditEvent: (organizationId: string | null, id: string) =>
    [...securityKeys.organization(organizationId), "audit-event", id] as const,
  auditPulse: (organizationId: string | null) =>
    [...securityKeys.organization(organizationId), "audit-pulse"] as const,
  bots: (organizationId: string | null) =>
    [...securityKeys.organization(organizationId), "bots"] as const,
  botOverview: (organizationId: string | null) =>
    [...securityKeys.bots(organizationId), "overview"] as const,
  botSettings: (organizationId: string | null) =>
    [...securityKeys.bots(organizationId), "settings"] as const,
  deviceAuthorizations: (organizationId: string | null) =>
    [...securityKeys.organization(organizationId), "device-authorizations"] as const,
  ipRules: (organizationId: string | null) =>
    [...securityKeys.organization(organizationId), "ip-rules"] as const,
  addressRefusals: (organizationId: string | null, limit: number) =>
    [...securityKeys.ipRules(organizationId), "refusals", limit] as const,
  enforcementChanges: (organizationId: string | null) =>
    [...securityKeys.ipRules(organizationId), "enforcement-changes"] as const,
  logSinks: (organizationId: string | null) =>
    [...securityKeys.organization(organizationId), "log-sinks"] as const,
  rateLimits: (organizationId: string | null) =>
    [...securityKeys.organization(organizationId), "rate-limits"] as const,
  riskSettings: (organizationId: string | null) =>
    [...securityKeys.organization(organizationId), "risk-settings"] as const,
};
