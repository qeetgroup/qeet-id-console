// Every activity query key sits under ["activity", organizationId]; see src/modules/users/api/keys.ts.

export const activityKeys = {
  all: ["activity"] as const,
  organization: (organizationId: string | null) => ["activity", organizationId] as const,
  history: (organizationId: string | null, filters: object) =>
    [...activityKeys.organization(organizationId), "history", filters] as const,
  /** The newest events under the same filters, re-read while the page is live. */
  head: (organizationId: string | null, filters: object) =>
    [...activityKeys.organization(organizationId), "head", filters] as const,
  summary: (organizationId: string | null, query: object) =>
    [...activityKeys.organization(organizationId), "summary", query] as const,
  related: (organizationId: string | null, eventId: string | null | undefined) =>
    [...activityKeys.organization(organizationId), "related", eventId] as const,
};
