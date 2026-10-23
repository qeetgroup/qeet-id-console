// Every dashboard query key sits under ["dashboard", tenantId]; see src/modules/users/api/keys.ts.
// Tiles that show another module's data read it through that module's queries instead.

export const dashboardKeys = {
  all: ["dashboard"] as const,
  tenant: (tenantId: string | null) => ["dashboard", tenantId] as const,
  activity: (tenantId: string | null) => [...dashboardKeys.tenant(tenantId), "activity"] as const,
  analytics: (tenantId: string | null) => [...dashboardKeys.tenant(tenantId), "analytics"] as const,
};
