// Every users query key sits under ["users", organizationId], so two organizations never share an entry
// and one prefix refreshes a tenant's lists, counts or a single person's views together.

/** One page of the members list: it pages by cursor only, in the server's own order. */
export type UserListParams = { limit: number; cursor?: string };

export const userKeys = {
  all: ["users"] as const, // every tenant
  organization: (organizationId: string | null) => ["users", organizationId] as const,
  lists: (organizationId: string | null) =>
    [...userKeys.organization(organizationId), "list"] as const,
  list: (organizationId: string | null, params: UserListParams) =>
    [...userKeys.lists(organizationId), params] as const,
  directory: (organizationId: string | null) =>
    [...userKeys.lists(organizationId), "directory"] as const,
  stats: (organizationId: string | null) =>
    [...userKeys.organization(organizationId), "stats"] as const,
  trends: (organizationId: string | null) =>
    [...userKeys.organization(organizationId), "trends"] as const,
  deleted: (organizationId: string | null) =>
    [...userKeys.organization(organizationId), "deleted"] as const,
  suspended: (organizationId: string | null) =>
    [...userKeys.organization(organizationId), "suspended"] as const,
  invitations: (organizationId: string | null) =>
    [...userKeys.organization(organizationId), "invitations"] as const,
  // One person: their record and every User 360 view of them.
  user: (organizationId: string | null, userId: string) =>
    [...userKeys.organization(organizationId), "user", userId] as const,
  detail: (organizationId: string | null, userId: string) =>
    [...userKeys.user(organizationId, userId), "detail"] as const,
  view: (organizationId: string | null, userId: string, view: User360View) =>
    [...userKeys.user(organizationId, userId), view] as const,
};

export type User360View =
  | "security"
  | "sessions"
  | "access"
  | "permissions"
  | "identities"
  | "activity"
  | "recent-activity";
