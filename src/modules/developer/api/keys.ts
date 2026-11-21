// Every developer query key sits under ["developer", organizationId]; see src/modules/users/api/keys.ts.
// The overview reads the same endpoints through its own schema, so it keeps its own keys: two
// fetchers must never share one cache entry.

export const developerKeys = {
  all: ["developer"] as const, // every tenant
  organization: (organizationId: string | null) => ["developer", organizationId] as const,
  apiKeys: (organizationId: string | null) =>
    [...developerKeys.organization(organizationId), "api-keys"] as const,
  servicePrincipals: (organizationId: string | null) =>
    [...developerKeys.organization(organizationId), "service-principals"] as const,
  secrets: (organizationId: string | null) =>
    [...developerKeys.organization(organizationId), "secrets"] as const,
  credentials: (organizationId: string | null) =>
    [...developerKeys.organization(organizationId), "credentials"] as const,
  agents: (organizationId: string | null) =>
    [...developerKeys.organization(organizationId), "agents"] as const,
  sponsoredAgents: (organizationId: string | null, userId: string | null) =>
    [...developerKeys.agents(organizationId), "sponsored-by", userId] as const,
  authHooks: (organizationId: string | null) =>
    [...developerKeys.organization(organizationId), "auth-hooks"] as const,
  webhooks: (organizationId: string | null) =>
    [...developerKeys.organization(organizationId), "webhooks"] as const,
  webhook: (organizationId: string | null, webhookId: string) =>
    [...developerKeys.webhooks(organizationId), webhookId] as const,
  webhookEvents: (organizationId: string | null) =>
    [...developerKeys.organization(organizationId), "webhook-events"] as const, // apart: never a list refresh
  notifications: (organizationId: string | null) =>
    [...developerKeys.organization(organizationId), "notifications"] as const,
  overview: (organizationId: string | null, source: string) =>
    [...developerKeys.organization(organizationId), "overview", source] as const,
  serviceHealth: (organizationId: string | null) =>
    [...developerKeys.organization(organizationId), "service-health"] as const,
  signingKeys: () => [...developerKeys.all, "signing-keys"] as const, // the deployment's, not a tenant's
};
