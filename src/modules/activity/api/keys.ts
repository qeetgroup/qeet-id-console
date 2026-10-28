// Every activity query key sits under ["activity", tenantId]; see src/modules/users/api/keys.ts.

export const activityKeys = {
  all: ["activity"] as const,
  tenant: (tenantId: string | null) => ["activity", tenantId] as const,
  history: (tenantId: string | null, filters: object) =>
    [...activityKeys.tenant(tenantId), "history", filters] as const,
  /** The newest events under the same filters, re-read while the page is live. */
  head: (tenantId: string | null, filters: object) =>
    [...activityKeys.tenant(tenantId), "head", filters] as const,
  summary: (tenantId: string | null, query: object) =>
    [...activityKeys.tenant(tenantId), "summary", query] as const,
  related: (tenantId: string | null, eventId: string | null | undefined) =>
    [...activityKeys.tenant(tenantId), "related", eventId] as const,
};
