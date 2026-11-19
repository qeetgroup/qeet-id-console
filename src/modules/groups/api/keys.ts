// Every groups query key sits under ["groups", organizationId]; see src/modules/users/api/keys.ts.

export const groupKeys = {
  all: ["groups"] as const, // every tenant
  organization: (organizationId: string | null) => ["groups", organizationId] as const,
  list: (organizationId: string | null) =>
    [...groupKeys.organization(organizationId), "list"] as const,
  members: (organizationId: string | null, groupId: string) =>
    [...groupKeys.organization(organizationId), "group", groupId, "members"] as const,
  templates: (organizationId: string | null) =>
    [...groupKeys.organization(organizationId), "templates"] as const,
};
