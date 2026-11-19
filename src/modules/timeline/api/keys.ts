// Every timeline query key sits under ["timeline", organizationId]; see src/modules/users/api/keys.ts.

export const timelineKeys = {
  all: ["timeline"] as const,
  organization: (organizationId: string | null) => ["timeline", organizationId] as const,
  person: (organizationId: string | null, userId: string, filters: object) =>
    [...timelineKeys.organization(organizationId), userId, filters] as const,
  /** The page's reads of one person's period: its summary, its sign-ins, its events. */
  period: (organizationId: string | null, userId: string, part: string, query: object) =>
    [...timelineKeys.organization(organizationId), userId, part, query] as const,
};
