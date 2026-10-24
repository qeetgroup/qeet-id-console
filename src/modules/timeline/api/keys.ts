// Every timeline query key sits under ["timeline", tenantId]; see src/modules/users/api/keys.ts.

export const timelineKeys = {
  all: ["timeline"] as const,
  tenant: (tenantId: string | null) => ["timeline", tenantId] as const,
  person: (tenantId: string | null, userId: string, filters: object) =>
    [...timelineKeys.tenant(tenantId), userId, filters] as const,
};
