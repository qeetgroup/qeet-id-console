// Who holds each role and what it lets them do, worked out in the browser from the reads the
// server has: the roles, each role's permissions, the people list (a person's own roles, by name),
// each group's roles and the members of the groups that hold one. The server has no role → holders
// lookup yet (a QTID gap), so this is how the Roles, RBAC and Permissions pages count people.

import type { Permission, Role } from "./api/rbac";

/** The built-in owner role, whose permissions the server keeps whole (rbac.CheckRoleEditable). */
export function isOwnerRole(role: Pick<Role, "name" | "is_system">): boolean {
  return role.is_system && role.name === "owner";
}

/**
 * A permission key as the server reads it: the resource before its last "." and the action after
 * (decide.SplitPermission). "user.read" is (user, read).
 */
export function splitPermission(key: string): { resource: string; action: string } {
  const at = key.lastIndexOf(".");
  return at > 0 && at < key.length - 1
    ? { resource: key.slice(0, at), action: key.slice(at + 1) }
    : { resource: "", action: key };
}

/** Whether a permission only reads: anything else changes something. */
export function isReadPermission(key: string): boolean {
  return splitPermission(key).action === "read";
}

export type ResourcePermissions = {
  /** The resource: the permission keys' part before the action. */
  key: string;
  /** Its permissions, by action. */
  actions: ReadonlyMap<string, Permission>;
};

/** The catalogue by resource, A to Z, each with its permissions by action. */
export function resourcesOf(perms: readonly Permission[]): ResourcePermissions[] {
  const map = new Map<string, Map<string, Permission>>();
  for (const p of perms) {
    const { resource, action } = splitPermission(p.key);
    const actions = map.get(resource) ?? new Map<string, Permission>();
    actions.set(action, p);
    map.set(resource, actions);
  }
  return [...map]
    .map(([key, actions]) => ({ key, actions }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** Every action in the catalogue, read and write first, then the rest A to Z. */
export function actionsOf(resources: readonly ResourcePermissions[]): string[] {
  const all = new Set(resources.flatMap((r) => [...r.actions.keys()]));
  const first = ["read", "write"].filter((a) => all.has(a));
  return [...first, ...[...all].filter((a) => !first.includes(a)).sort()];
}

export type PersonRef = { id: string; roles?: readonly string[] | null };
export type GroupRef = { id: string; name: string };

export type RoleGroup = GroupRef & {
  /** Its members' IDs, once read. */
  members?: readonly string[];
};

export interface RoleAccess {
  role: Role;
  /** Its permission keys, once read. */
  permissions?: ReadonlySet<string>;
  /** People who hold it themselves (a person's own roles, from the people list). */
  direct: readonly string[];
  /** Groups it's given to; a group's role reaches its own members, not groups inside it. */
  groups: readonly RoleGroup[];
  /** Everyone who holds it, directly or through a group, with what's known. */
  holders: ReadonlySet<string>;
  /** People who hold it only through a group. */
  throughGroupsOnly: number;
}

export type AccessInput = {
  roles: readonly Role[];
  /** Each role's permission keys, by role ID, for the roles read so far. */
  rolePermissions: ReadonlyMap<string, readonly string[]>;
  /** Everyone in the organisation, when the caller may read people. */
  people?: readonly PersonRef[];
  /** The organisation's groups, when the caller may read them. */
  groups?: readonly GroupRef[];
  /** Each group's role IDs, by group ID, for the groups read so far. */
  groupRoles?: ReadonlyMap<string, readonly string[]>;
  /** Each group's member IDs, by group ID, for the groups read so far. */
  members?: ReadonlyMap<string, readonly string[]>;
};

/** Each role with who holds it and what it grants, from what's been read. */
export function roleAccess(input: AccessInput): RoleAccess[] {
  // The people list names a person's own roles; names are unique in an organisation, ignoring
  // case (rbac uq_roles_tenant_name).
  const byName = new Map(input.roles.map((r) => [r.name.toLowerCase(), r.id]));
  const direct = new Map<string, string[]>();
  for (const person of input.people ?? []) {
    for (const name of person.roles ?? []) {
      const id = byName.get(name.toLowerCase());
      if (id) direct.set(id, [...(direct.get(id) ?? []), person.id]);
    }
  }
  const viaGroups = new Map<string, RoleGroup[]>();
  for (const group of input.groups ?? []) {
    for (const roleId of input.groupRoles?.get(group.id) ?? []) {
      const entry: RoleGroup = { ...group, members: input.members?.get(group.id) };
      viaGroups.set(roleId, [...(viaGroups.get(roleId) ?? []), entry]);
    }
  }
  return input.roles.map((role) => {
    const own = direct.get(role.id) ?? [];
    const groups = viaGroups.get(role.id) ?? [];
    const holders = new Set(own);
    for (const g of groups) for (const id of g.members ?? []) holders.add(id);
    const perms = input.rolePermissions.get(role.id);
    return {
      role,
      permissions: perms ? new Set(perms) : undefined,
      direct: own,
      groups,
      holders,
      throughGroupsOnly: holders.size - own.length,
    };
  });
}

/** What each person can do: the union of the permissions of every role they hold. */
export function permissionsByPerson(access: readonly RoleAccess[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const a of access) {
    for (const id of a.holders) {
      const held = out.get(id) ?? new Set<string>();
      for (const key of a.permissions ?? []) held.add(key);
      out.set(id, held);
    }
  }
  return out;
}

/** How far a person's access goes: every permission, some changes, reading only, or none. */
export const REACH = ["every", "changes", "reads", "none"] as const;
export type Reach = (typeof REACH)[number];

export function reachOf(held: ReadonlySet<string> | undefined, catalogue: number): Reach {
  if (!held || held.size === 0) return "none";
  if (catalogue > 0 && held.size >= catalogue) return "every";
  return [...held].some((key) => !isReadPermission(key)) ? "changes" : "reads";
}

/** People who hold each permission, by key. */
export function holdersByPermission(access: readonly RoleAccess[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const a of access) {
    for (const key of a.permissions ?? []) {
      const set = out.get(key) ?? new Set<string>();
      for (const id of a.holders) set.add(id);
      out.set(key, set);
    }
  }
  return out;
}

/** How widely a permission is held: by everyone, most people, some, or only through the owner role. */
export const SPREAD = ["everyone", "most", "some", "owners"] as const;
export type Spread = (typeof SPREAD)[number];

export function spreadOf(
  key: string,
  access: readonly RoleAccess[],
  holders: ReadonlySet<string> | undefined,
  people: number,
): Spread {
  const others = access.some((a) => !isOwnerRole(a.role) && a.permissions?.has(key));
  if (!others) return "owners";
  const n = holders?.size ?? 0;
  if (people > 0 && n >= people) return "everyone";
  if (people > 0 && n * 2 > people) return "most";
  return "some";
}

/** "A and B", "A, B and C", "A, B and 3 more": a short list of names in the sentence it sits in. */
export function shortList(
  names: readonly string[],
  words: { and: string; more: (n: number) => string },
  max = 3,
): string {
  if (names.length <= max) {
    return names.length < 2
      ? (names[0] ?? "")
      : `${names.slice(0, -1).join(", ")} ${words.and} ${names[names.length - 1]}`;
  }
  return `${names.slice(0, max).join(", ")} ${words.and} ${words.more(names.length - max)}`;
}
