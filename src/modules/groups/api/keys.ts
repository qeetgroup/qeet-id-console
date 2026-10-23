// Every groups query key sits under ["groups", tenantId]; see src/modules/users/api/keys.ts.

export const groupKeys = {
  all: ["groups"] as const, // every tenant
  tenant: (tenantId: string | null) => ["groups", tenantId] as const,
  list: (tenantId: string | null) => [...groupKeys.tenant(tenantId), "list"] as const,
  members: (tenantId: string | null, groupId: string) =>
    [...groupKeys.tenant(tenantId), "group", groupId, "members"] as const,
  templates: (tenantId: string | null) => [...groupKeys.tenant(tenantId), "templates"] as const,
};
