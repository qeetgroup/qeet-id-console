// Every users query key sits under ["users", tenantId], so two organizations never share an entry
// and one prefix refreshes a tenant's lists, counts or a single person's views together.

export type UserListParams = { limit: number; offset: number };

export const userKeys = {
  all: ["users"] as const, // every tenant
  tenant: (tenantId: string | null) => ["users", tenantId] as const,
  lists: (tenantId: string | null) => [...userKeys.tenant(tenantId), "list"] as const,
  list: (tenantId: string | null, params: UserListParams) =>
    [...userKeys.lists(tenantId), params] as const,
  stats: (tenantId: string | null) => [...userKeys.tenant(tenantId), "stats"] as const,
  trends: (tenantId: string | null) => [...userKeys.tenant(tenantId), "trends"] as const,
  deleted: (tenantId: string | null) => [...userKeys.tenant(tenantId), "deleted"] as const,
  suspended: (tenantId: string | null) => [...userKeys.tenant(tenantId), "suspended"] as const,
  invitations: (tenantId: string | null) => [...userKeys.tenant(tenantId), "invitations"] as const,
  // One person: their record and every User 360 view of them.
  user: (tenantId: string | null, userId: string) =>
    [...userKeys.tenant(tenantId), "user", userId] as const,
  detail: (tenantId: string | null, userId: string) =>
    [...userKeys.user(tenantId, userId), "detail"] as const,
  view: (tenantId: string | null, userId: string, view: User360View) =>
    [...userKeys.user(tenantId, userId), view] as const,
};

export type User360View =
  | "security"
  | "sessions"
  | "access"
  | "permissions"
  | "identities"
  | "activity"
  | "recent-activity";
