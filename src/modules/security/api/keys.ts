// Every security query key sits under ["security", tenantId]; see src/modules/users/api/keys.ts.

export const securityKeys = {
  all: ["security"] as const,
  tenant: (tenantId: string | null) => ["security", tenantId] as const,
  anomalies: (tenantId: string | null) => [...securityKeys.tenant(tenantId), "anomalies"] as const,
  anomalyList: (tenantId: string | null) => [...securityKeys.anomalies(tenantId), "list"] as const,
  anomalySummary: (tenantId: string | null) =>
    [...securityKeys.anomalies(tenantId), "summary"] as const,
  auditAnomalies: (tenantId: string | null) =>
    [...securityKeys.tenant(tenantId), "audit-anomalies"] as const,
  auditAnomalyList: (tenantId: string | null, status: string) =>
    [...securityKeys.auditAnomalies(tenantId), "list", status] as const,
  auditAnomalySummary: (tenantId: string | null) =>
    [...securityKeys.auditAnomalies(tenantId), "summary"] as const,
  auditAnomalySettings: (tenantId: string | null) =>
    [...securityKeys.auditAnomalies(tenantId), "settings"] as const,
  auditLog: (tenantId: string | null, filters: object, cursor: string | undefined) =>
    [...securityKeys.tenant(tenantId), "audit-log", filters, cursor] as const,
  auditEvent: (tenantId: string | null, id: string) =>
    [...securityKeys.tenant(tenantId), "audit-event", id] as const,
  auditPulse: (tenantId: string | null) =>
    [...securityKeys.tenant(tenantId), "audit-pulse"] as const,
  bots: (tenantId: string | null) => [...securityKeys.tenant(tenantId), "bots"] as const,
  botOverview: (tenantId: string | null) => [...securityKeys.bots(tenantId), "overview"] as const,
  botSettings: (tenantId: string | null) => [...securityKeys.bots(tenantId), "settings"] as const,
  deviceAuthorizations: (tenantId: string | null) =>
    [...securityKeys.tenant(tenantId), "device-authorizations"] as const,
  ipRules: (tenantId: string | null) => [...securityKeys.tenant(tenantId), "ip-rules"] as const,
  addressRefusals: (tenantId: string | null, limit: number) =>
    [...securityKeys.ipRules(tenantId), "refusals", limit] as const,
  enforcementChanges: (tenantId: string | null) =>
    [...securityKeys.ipRules(tenantId), "enforcement-changes"] as const,
  logSinks: (tenantId: string | null) => [...securityKeys.tenant(tenantId), "log-sinks"] as const,
  rateLimits: (tenantId: string | null) =>
    [...securityKeys.tenant(tenantId), "rate-limits"] as const,
  riskSettings: (tenantId: string | null) =>
    [...securityKeys.tenant(tenantId), "risk-settings"] as const,
};
