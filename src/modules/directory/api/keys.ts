// Every directory query key sits under ["directory", tenantId]; see src/modules/users/api/keys.ts.

export const directoryKeys = {
  all: ["directory"] as const,
  tenant: (tenantId: string | null) => ["directory", tenantId] as const,
  connections: (tenantId: string | null) =>
    [...directoryKeys.tenant(tenantId), "connections"] as const,
  events: (tenantId: string | null, filters: object) =>
    [...directoryKeys.tenant(tenantId), "events", filters] as const,
  errors: (tenantId: string | null, filters: object) =>
    [...directoryKeys.tenant(tenantId), "errors", filters] as const,
  mappings: (tenantId: string | null, connectionId: string) =>
    [...directoryKeys.tenant(tenantId), "mappings", connectionId] as const,
};
