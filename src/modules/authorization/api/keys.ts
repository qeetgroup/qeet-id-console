// Every authorization query key sits under ["authorization", tenantId]; see
// src/modules/users/api/keys.ts.

export const authzKeys = {
  all: ["authorization"] as const,
  tenant: (tenantId: string | null) => ["authorization", tenantId] as const,
  permissions: (tenantId: string | null) => [...authzKeys.tenant(tenantId), "permissions"] as const,
  // A role's permissions sit under the roles, which a role change refreshes.
  roles: (tenantId: string | null) => [...authzKeys.tenant(tenantId), "roles"] as const,
  rolePermissions: (tenantId: string | null, roleId: string | null) =>
    [...authzKeys.roles(tenantId), roleId, "permissions"] as const,
  groupRoleLists: (tenantId: string | null) =>
    [...authzKeys.tenant(tenantId), "group-roles"] as const,
  groupRoles: (tenantId: string | null, groupId: string) =>
    [...authzKeys.groupRoleLists(tenantId), groupId] as const,
  abacPolicies: (tenantId: string | null) =>
    [...authzKeys.tenant(tenantId), "abac-policies"] as const,
  abacPolicy: (tenantId: string | null, id: string | null) =>
    [...authzKeys.abacPolicies(tenantId), id] as const,
  // Every view of the relation tuples, which one tuple change moves together.
  relations: (tenantId: string | null) => [...authzKeys.tenant(tenantId), "relations"] as const,
  relationTuples: (tenantId: string | null, object: string) =>
    [...authzKeys.relations(tenantId), "object", object] as const,
  subjectTuples: (tenantId: string | null, subject: string) =>
    [...authzKeys.relations(tenantId), "subject", subject] as const,
  relationGraph: (tenantId: string | null, object: string, relation: string, depth?: number) =>
    [...authzKeys.relations(tenantId), "graph", object, relation, depth] as const,
  audit: (tenantId: string | null, filter: object) =>
    [...authzKeys.tenant(tenantId), "audit", filter] as const,
};
