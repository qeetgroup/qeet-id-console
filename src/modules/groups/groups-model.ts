// The Groups list's rules, pure so the page and its tests share them. Groups nest: the list shows
// them as a tree whose families fold, and lists them flat (each with its path) while a search or
// filter narrows it. A group's members are its own; the roles it grants reach only them, not the
// people in the groups inside it (the server's rule).

import type { TableSort } from "@qeetrix/react";
import type { z } from "zod";

import { createIntentSearch } from "@/shared/hooks/use-create-intent";
import { searchEnum, searchText } from "@/shared/utils/search-params";
import type { Group } from "./api/groups";

/** Over this many groups, families start folded, so the list opens at the top level. */
export const FOLD_OVER = 50;

/** A group's size: how many people it covers, its groups' people included. */
export const SIZES = ["empty", "one", "few", "team", "large"] as const;
export type GroupSize = (typeof SIZES)[number];
export function sizeOf(people: number): GroupSize {
  if (people === 0) return "empty";
  if (people === 1) return "one";
  if (people <= 5) return "few";
  if (people <= 20) return "team";
  return "large";
}

/** What needs a look: no one in it or its groups, or roles granted to no one. */
export const GROUP_LOOKS = ["empty", "unused-roles"] as const;
export type GroupLook = (typeof GROUP_LOOKS)[number];

/**
 * The list's address: `?q=…&size=…&grants=some|none&role=…&inside=<group id>&look=…`, and
 * `action=create`.
 */
export const groupsListSearch = createIntentSearch.extend({
  q: searchText(),
  size: searchEnum(SIZES),
  grants: searchEnum(["some", "none"]),
  role: searchText(),
  inside: searchText(),
  look: searchEnum(GROUP_LOOKS),
});
export type GroupsListSearch = z.infer<typeof groupsListSearch>;
/** The filters in the address; each narrows the list, and they combine. */
export type GroupFilters = Omit<GroupsListSearch, "action">;

/** The role names each group grants, by group ID; a group not in it hasn't loaded yet. */
export type RolesByGroup = ReadonlyMap<string, readonly string[]>;

export type GroupNode = Group & {
  depth: number;
  children: GroupNode[];
  /** The people it covers: its members, and its groups' (one person in two groups counts twice). */
  people: number;
  /** How many groups are inside it, at any depth. */
  inside: number;
  /** The names of the groups it sits in, outermost first. */
  path: string[];
};

const byName = (a: Group, b: Group) => a.name.localeCompare(b.name);

/** The groups as a tree, each level by name. A group whose parent is missing sits at the top. */
export function groupTree(groups: readonly Group[]): GroupNode[] {
  const nodes = new Map<string, GroupNode>(
    groups.map((g) => [g.id, { ...g, depth: 0, children: [], people: 0, inside: 0, path: [] }]),
  );
  const roots: GroupNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    (parent && parent !== node ? parent.children : roots).push(node);
  }
  const seen = new Set<string>();
  const walk = (node: GroupNode, depth: number, path: string[]) => {
    seen.add(node.id);
    node.depth = depth;
    node.path = path;
    node.children = node.children.filter((c) => !seen.has(c.id)).sort(byName);
    for (const child of node.children) walk(child, depth + 1, [...path, node.name]);
    node.people = node.member_count + node.children.reduce((sum, c) => sum + c.people, 0);
    node.inside = node.children.reduce((sum, c) => sum + 1 + c.inside, 0);
  };
  roots.sort(byName);
  for (const root of roots) walk(root, 0, []);
  return roots;
}

/** Every group in the tree, each before the groups inside it. */
export function everyGroup(roots: readonly GroupNode[]): GroupNode[] {
  const out: GroupNode[] = [];
  const walk = (node: GroupNode) => {
    out.push(node);
    node.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

/** The group, and the groups inside it. */
function family(node: GroupNode): GroupNode[] {
  return everyGroup([node]);
}

/** Whether a group grants roles that reach no one: it grants some and has no members. */
export function grantsToNoOne(node: GroupNode, roles: RolesByGroup): boolean {
  return (roles.get(node.id)?.length ?? 0) > 0 && node.member_count === 0;
}

/** A search or a filter (other than `inside`) lists the matches flat. */
export function isFlat(filters: GroupFilters): boolean {
  return !!(filters.q?.trim() || filters.size || filters.grants || filters.role || filters.look);
}

/** Whether a group is one the filters and search leave. */
export function matchesGroup(node: GroupNode, filters: GroupFilters, roles: RolesByGroup): boolean {
  const query = filters.q?.trim().toLowerCase();
  if (query && !`${node.name} ${node.description}`.toLowerCase().includes(query)) return false;
  if (filters.size && sizeOf(node.people) !== filters.size) return false;
  const granted = roles.get(node.id) ?? [];
  if (filters.grants === "some" && !granted.length) return false;
  if (filters.grants === "none" && granted.length) return false;
  if (filters.role && !granted.includes(filters.role)) return false;
  if (filters.look === "empty" && node.people !== 0) return false;
  if (filters.look === "unused-roles" && !grantsToNoOne(node, roles)) return false;
  return true;
}

export type GroupSortColumn = "group" | "members" | "created";
const SORT_VALUE: Record<GroupSortColumn, (g: GroupNode) => string | number> = {
  group: (g) => g.name.toLowerCase(),
  members: (g) => g.member_count,
  created: (g) => Date.parse(g.created_at),
};
function sorted(rows: readonly GroupNode[], sort: TableSort | null): GroupNode[] {
  const value = sort && SORT_VALUE[sort.column as GroupSortColumn];
  if (!sort || !value) return [...rows];
  const way = sort.direction === "ascending" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    return (x < y ? -1 : x > y ? 1 : 0) * way;
  });
}

/**
 * The rows on show. Searching or filtering: every match, flat, in the sort (within one group's
 * family when `inside` is set). Otherwise the tree, families open or folded, each level in the sort;
 * with `inside`, that group's family alone.
 */
export function visibleGroups(
  roots: readonly GroupNode[],
  filters: GroupFilters,
  open: ReadonlySet<string>,
  roles: RolesByGroup,
  sort: TableSort | null,
): GroupNode[] {
  const within = filters.inside
    ? everyGroup(roots).find((g) => g.id === filters.inside)
    : undefined;
  if (isFlat(filters)) {
    const pool = within ? family(within) : everyGroup(roots);
    return sorted(
      pool.filter((g) => matchesGroup(g, filters, roles)),
      sort ?? { column: "group", direction: "ascending" },
    );
  }
  const out: GroupNode[] = [];
  const walk = (node: GroupNode) => {
    out.push(node);
    if (open.has(node.id)) sorted(node.children, sort).forEach(walk);
  };
  sorted(within ? [within] : roots, sort).forEach(walk);
  return out;
}

export type GroupRow = GroupNode & { continued?: boolean };

/** One page of rows; a family that runs on from the page before marks its first row. */
export function pageOf(
  rows: readonly GroupNode[],
  offset: number,
  size: number,
  flat: boolean,
): GroupRow[] {
  const page: GroupRow[] = rows.slice(offset, offset + size);
  const first = page[0];
  if (!flat && offset > 0 && first && first.depth > 0) page[0] = { ...first, continued: true };
  return page;
}

/** The groups that have groups inside: the ones that fold. */
export function foldable(roots: readonly GroupNode[]): string[] {
  return everyGroup(roots)
    .filter((g) => g.children.length)
    .map((g) => g.id);
}

/**
 * The line under a group's name, or none: its description, unless it only repeats the name or
 * the path ("Everyone in Design", "Engineering — Payments").
 */
export function describedAs(node: GroupNode): string | null {
  const text = node.description.trim();
  if (!text) return null;
  const parent = node.path[node.path.length - 1];
  const repeats = [node.name, `Everyone in ${node.name}`];
  if (parent) repeats.push(`${parent} — ${node.name}`, `${parent} - ${node.name}`);
  return repeats.some((r) => r.toLowerCase() === text.toLowerCase()) ? null : text;
}
