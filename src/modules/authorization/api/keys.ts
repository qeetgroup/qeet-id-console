// Every authorization query key sits under ["authorization", organizationId]; see
// src/modules/users/api/keys.ts.

export const authzKeys = {
  all: ["authorization"] as const,
  organization: (organizationId: string | null) => ["authorization", organizationId] as const,
  permissions: (organizationId: string | null) =>
    [...authzKeys.organization(organizationId), "permissions"] as const,
  // A role's permissions sit under the roles, which a role change refreshes.
  roles: (organizationId: string | null) =>
    [...authzKeys.organization(organizationId), "roles"] as const,
  rolePermissions: (organizationId: string | null, roleId: string | null) =>
    [...authzKeys.roles(organizationId), roleId, "permissions"] as const,
  groupRoleLists: (organizationId: string | null) =>
    [...authzKeys.organization(organizationId), "group-roles"] as const,
  groupRoles: (organizationId: string | null, groupId: string) =>
    [...authzKeys.groupRoleLists(organizationId), groupId] as const,
  abacPolicies: (organizationId: string | null) =>
    [...authzKeys.organization(organizationId), "abac-policies"] as const,
  abacPolicy: (organizationId: string | null, id: string | null) =>
    [...authzKeys.abacPolicies(organizationId), id] as const,
  // Every view of the relation tuples, which one tuple change moves together.
  relations: (organizationId: string | null) =>
    [...authzKeys.organization(organizationId), "relations"] as const,
  relationTuples: (organizationId: string | null, object: string) =>
    [...authzKeys.relations(organizationId), "object", object] as const,
  subjectTuples: (organizationId: string | null, subject: string) =>
    [...authzKeys.relations(organizationId), "subject", subject] as const,
  relationGraph: (
    organizationId: string | null,
    object: string,
    relation: string,
    depth?: number,
  ) => [...authzKeys.relations(organizationId), "graph", object, relation, depth] as const,
};
