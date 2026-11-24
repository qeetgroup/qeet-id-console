// Every dashboard query key sits under ["dashboard", organizationId]; see src/modules/users/api/keys.ts.
// Tiles that show another module's data read it through that module's queries instead.

export const dashboardKeys = {
  all: ["dashboard"] as const,
  organization: (organizationId: string | null) => ["dashboard", organizationId] as const,
  activity: (organizationId: string | null) =>
    [...dashboardKeys.organization(organizationId), "activity"] as const,
  analytics: (organizationId: string | null) =>
    [...dashboardKeys.organization(organizationId), "analytics"] as const,
  overview: (organizationId: string | null) =>
    [...dashboardKeys.organization(organizationId), "overview"] as const,
};
