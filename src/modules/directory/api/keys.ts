// Every directory query key sits under ["directory", organizationId]; see src/modules/users/api/keys.ts.

export const directoryKeys = {
  all: ["directory"] as const,
  organization: (organizationId: string | null) => ["directory", organizationId] as const,
  connections: (organizationId: string | null) =>
    [...directoryKeys.organization(organizationId), "connections"] as const,
  events: (organizationId: string | null, filters: object) =>
    [...directoryKeys.organization(organizationId), "events", filters] as const,
  errors: (organizationId: string | null, filters: object) =>
    [...directoryKeys.organization(organizationId), "errors", filters] as const,
  mappings: (organizationId: string | null, connectionId: string) =>
    [...directoryKeys.organization(organizationId), "mappings", connectionId] as const,
};
