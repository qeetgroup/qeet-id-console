// Every read the role lists need to say who holds each role: the roles and the catalogue, each
// role's permissions, the people list, the groups, each group's roles and the members of the groups
// that hold one. The server has no role → holders lookup (a QTID gap), so the console reads them
// all; each read is cached and shared with Users and Groups.

import { type QueryObserverResult, useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { type Group, type GroupMember, groupQueries } from "@/modules/groups";
import { type User, userQueries } from "@/modules/users";
import { useTenantId } from "@/platform/auth/session";
import { useCapabilities } from "@/platform/security/capability-provider";
import { type RoleAccess, roleAccess } from "../role-model";
import { type Permission, type Role, roleQueries, usePermissions, useRoles } from "./rbac";
import { type GroupRole, groupRoleQueries } from "./rbac-groups";

/** Past this many groups their roles aren't read one by one, and holders through groups wait. */
export const GROUP_ROLES_UP_TO = 200;

const NO_ROLES: Role[] = [];
const NO_PERMISSIONS: Permission[] = [];
const NO_GROUPS: Group[] = [];

// Stable, so useQueries keeps its combined result while no query changes.
function byIndex<T>(results: QueryObserverResult<{ items: T[] }>[]) {
  return {
    items: results.map((r) => r.data?.items),
    pending: results.some((r) => r.isPending),
    error: results.find((r) => r.error)?.error ?? null,
  };
}
const combinePermissions = (r: QueryObserverResult<{ items: Permission[] }>[]) => byIndex(r);
const combineGroupRoles = (r: QueryObserverResult<{ items: GroupRole[] }>[]) => byIndex(r);
const combineMembers = (r: QueryObserverResult<{ items: GroupMember[] }>[]) => byIndex(r);

export type RoleAccessView = {
  roles: Role[];
  catalogue: Permission[];
  access: RoleAccess[];
  /** Everyone in the organisation, when the caller may read people. */
  people?: User[];
  peopleById: ReadonlyMap<string, User>;
  groups: Group[];
  /** People are counted: the caller may read them and they've loaded. */
  peopleKnown: boolean;
  /** Holders through groups are counted: every group's roles and members have loaded. */
  groupsKnown: boolean;
  /** Every role's permissions have loaded. */
  permissionsKnown: boolean;
  rolesQuery: ReturnType<typeof useRoles>;
  catalogueQuery: ReturnType<typeof usePermissions>;
  /** When the data was read, for relative dates. */
  now: number;
};

export function useRoleAccess(): RoleAccessView {
  const tenantId = useTenantId();
  const can = useCapabilities().can;
  const canPeople = can("user.read");
  const canGroups = can("group.read");

  const rolesQuery = useRoles();
  const catalogueQuery = usePermissions();
  const roles = rolesQuery.data?.items ?? NO_ROLES;
  const catalogue = catalogueQuery.data?.items ?? NO_PERMISSIONS;

  const perms = useQueries({
    queries: roles.map((r) => roleQueries.permissions(tenantId, r.id)),
    combine: combinePermissions,
  });
  const peopleQuery = useQuery({
    ...userQueries.directory(tenantId),
    enabled: canPeople && !!tenantId,
  });
  const groupsQuery = useQuery({
    ...groupQueries.list(tenantId),
    enabled: canGroups && !!tenantId,
  });
  const groups = groupsQuery.data?.items ?? NO_GROUPS;
  const readGroups = groups.length <= GROUP_ROLES_UP_TO ? groups : NO_GROUPS;
  const groupRoles = useQueries({
    queries: readGroups.map((g) => groupRoleQueries.list(tenantId, g.id)),
    combine: combineGroupRoles,
  });
  // Members only of the groups that hold a role: the rest reach no one.
  const granting = useMemo(
    () => readGroups.filter((_, i) => (groupRoles.items[i]?.length ?? 0) > 0),
    [readGroups, groupRoles.items],
  );
  const members = useQueries({
    queries: granting.map((g) => groupQueries.members(tenantId, g.id)),
    combine: combineMembers,
  });

  const people = peopleQuery.data?.items;
  const access = useMemo(() => {
    const rolePermissions = new Map<string, string[]>();
    roles.forEach((r, i) => {
      const items = perms.items[i];
      if (items)
        rolePermissions.set(
          r.id,
          items.map((p) => p.key),
        );
    });
    const groupRoleIds = new Map<string, string[]>();
    readGroups.forEach((g, i) => {
      const items = groupRoles.items[i];
      if (items)
        groupRoleIds.set(
          g.id,
          items.map((r) => r.role_id),
        );
    });
    const memberIds = new Map<string, string[]>();
    granting.forEach((g, i) => {
      const items = members.items[i];
      if (items)
        memberIds.set(
          g.id,
          items.map((m) => m.user_id),
        );
    });
    return roleAccess({
      roles,
      rolePermissions,
      people,
      groups: canGroups ? readGroups : undefined,
      groupRoles: groupRoleIds,
      members: memberIds,
    });
  }, [
    roles,
    perms.items,
    people,
    canGroups,
    readGroups,
    groupRoles.items,
    granting,
    members.items,
  ]);

  const peopleById = useMemo(() => new Map((people ?? []).map((u) => [u.id, u])), [people]);

  return {
    roles,
    catalogue,
    access,
    people,
    peopleById,
    groups,
    peopleKnown: canPeople && !!peopleQuery.data,
    groupsKnown:
      canGroups &&
      !!groupsQuery.data &&
      groups.length <= GROUP_ROLES_UP_TO &&
      !groupRoles.pending &&
      !members.pending,
    permissionsKnown: !!rolesQuery.data && !perms.pending,
    rolesQuery,
    catalogueQuery,
    now: rolesQuery.dataUpdatedAt || Date.now(),
  };
}
