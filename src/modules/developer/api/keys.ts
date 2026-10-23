// Every developer query key sits under ["developer", tenantId]; see src/modules/users/api/keys.ts.
// The overview reads the same endpoints through its own schema, so it keeps its own keys: two
// fetchers must never share one cache entry.

export const developerKeys = {
  all: ["developer"] as const, // every tenant
  tenant: (tenantId: string | null) => ["developer", tenantId] as const,
  apiKeys: (tenantId: string | null) => [...developerKeys.tenant(tenantId), "api-keys"] as const,
  servicePrincipals: (tenantId: string | null) =>
    [...developerKeys.tenant(tenantId), "service-principals"] as const,
  secrets: (tenantId: string | null) => [...developerKeys.tenant(tenantId), "secrets"] as const,
  credentials: (tenantId: string | null) =>
    [...developerKeys.tenant(tenantId), "credentials"] as const,
  agents: (tenantId: string | null) => [...developerKeys.tenant(tenantId), "agents"] as const,
  sponsoredAgents: (tenantId: string | null, userId: string | null) =>
    [...developerKeys.agents(tenantId), "sponsored-by", userId] as const,
  authHooks: (tenantId: string | null) =>
    [...developerKeys.tenant(tenantId), "auth-hooks"] as const,
  webhooks: (tenantId: string | null) => [...developerKeys.tenant(tenantId), "webhooks"] as const,
  webhook: (tenantId: string | null, webhookId: string) =>
    [...developerKeys.webhooks(tenantId), webhookId] as const,
  notifications: (tenantId: string | null) =>
    [...developerKeys.tenant(tenantId), "notifications"] as const,
  overview: (tenantId: string | null, source: string) =>
    [...developerKeys.tenant(tenantId), "overview", source] as const,
  signingKeys: () => [...developerKeys.all, "signing-keys"] as const, // the deployment's, not a tenant's
};
