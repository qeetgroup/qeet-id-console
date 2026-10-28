// The Roles list's filters, in its address, and what each keeps.

import type { TableSort } from "@qeetrix/react";

import { isOwnerRole, type RoleAccess } from "@/modules/authorization/role-model";

export const ROLE_TYPES = ["custom", "builtin"] as const;
export const ROLE_LOOKS = ["unused", "every", "empty"] as const;
export type RoleLook = (typeof ROLE_LOOKS)[number];

/** `?q=…&type=custom|builtin&look=…`, and `role=<id>` for the open role. */
export type RoleFilters = {
  q?: string;
  type?: (typeof ROLE_TYPES)[number];
  look?: RoleLook;
};

/**
 * Whether a role needs this look: no one holds it, it grants every permission (the owner role
 * always does, by design, so it isn't counted), or it grants nothing.
 */
export function roleLook(a: RoleAccess, look: RoleLook, catalogue: number): boolean {
  switch (look) {
    case "unused":
      return a.holders.size === 0;
    case "every":
      return !isOwnerRole(a.role) && catalogue > 0 && (a.permissions?.size ?? 0) >= catalogue;
    case "empty":
      return !!a.permissions && a.permissions.size === 0;
  }
}

export function matchesRole(a: RoleAccess, filters: RoleFilters, catalogue: number): boolean {
  if (filters.type === "custom" && a.role.is_system) return false;
  if (filters.type === "builtin" && !a.role.is_system) return false;
  if (filters.look && !roleLook(a, filters.look, catalogue)) return false;
  const q = filters.q?.trim().toLowerCase();
  if (q && !`${a.role.name} ${a.role.description}`.toLowerCase().includes(q)) return false;
  return true;
}

/** Most held first, unless a header asks otherwise; ties by name. */
export function sortRoles(rows: RoleAccess[], sort: TableSort | null): RoleAccess[] {
  const by = (a: RoleAccess, b: RoleAccess): number => {
    switch (sort?.column) {
      case "name":
        return a.role.name.localeCompare(b.role.name);
      case "permissions":
        return (a.permissions?.size ?? 0) - (b.permissions?.size ?? 0);
      default:
        return a.holders.size - b.holders.size;
    }
  };
  const dir = sort ? (sort.direction === "ascending" ? 1 : -1) : -1;
  return [...rows].sort((a, b) => dir * by(a, b) || a.role.name.localeCompare(b.role.name));
}
