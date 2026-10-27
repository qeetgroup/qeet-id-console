// What the Users list works out from everyone in the organisation: when each person was last
// active, what about them needs a look, the filters in the page address, and the counts beside
// each filter. Pure, so the page and its tests share it.
import type { TableSort } from "@qeetrix/react";
import type { z } from "zod";

import { createIntentSearch } from "@/shared/hooks/use-create-intent";
import { searchEnum, searchText } from "@/shared/utils/search-params";

import type { User } from "./api/users";

export const DAY_MS = 86_400_000;

/** The share of people with two-step verification the list measures the organisation against. */
export const TWO_STEP_TARGET = 80;

/** How long ago someone was last active, today to never: one ordinal scale. */
export const RECENCY = ["today", "week", "month", "older", "never"] as const;
export type Recency = (typeof RECENCY)[number];

/** Which recency a person is in, from their last sign-in or request. */
export function recency(user: Pick<User, "last_seen_at">, now: number): Recency {
  if (!user.last_seen_at) return "never";
  const age = now - Date.parse(user.last_seen_at);
  if (age < DAY_MS) return "today";
  if (age < 7 * DAY_MS) return "week";
  if (age < 30 * DAY_MS) return "month";
  return "older";
}

// The roles that run the organisation; others, such as Billing Admin, administer one area.
const ADMIN_ROLES = new Set(["owner", "admin"]);

/** Holds a role that runs the organisation, so two-step verification matters most for them. */
export function isAdmin(user: Pick<User, "roles">): boolean {
  return (user.roles ?? []).some((role) => ADMIN_ROLES.has(role.toLowerCase()));
}

/** The person's department, from what the organisation records about them. */
export function department(user: Pick<User, "metadata">): string | null {
  const value = user.metadata?.department;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The person's name, or their email without one. */
export function personName(user: Pick<User, "display_name" | "email">): string {
  return user.display_name?.trim() || user.email;
}

/** What needs a look, each a list of its own: the most serious first. */
export const LOOKS = ["admins-no-two-step", "dormant", "never", "unverified", "suspended"] as const;
export type Look = (typeof LOOKS)[number];

/** Whether a person is on a "Needs a look" list. */
export function needsLook(user: User, look: Look, now: number): boolean {
  switch (look) {
    case "admins-no-two-step":
      return isAdmin(user) && !user.mfa_enabled;
    case "dormant":
      return recency(user, now) === "older";
    case "never":
      return recency(user, now) === "never";
    case "unverified":
      return !user.email_verified_at;
    case "suspended":
      return user.status === "suspended";
  }
}

/** Whether someone can sign in: All users shows everyone, or one status. */
export const STATUSES = ["active", "suspended"] as const;
/** A suspension's risk and review, as the suspended list filters them. */
export const RISKS = ["high", "medium", "low", "unknown"] as const;
export const REVIEWS = ["pending", "reviewed"] as const;

/**
 * The list's address: `?q=…&status=…&role=…&dept=…&twostep=on|off&seen=…&look=…`, with
 * `reason`, `risk` and `review` while Suspended is chosen, and `action=create`.
 */
export const usersListSearch = createIntentSearch.extend({
  q: searchText(),
  status: searchEnum(STATUSES),
  reason: searchText(),
  risk: searchEnum(RISKS),
  review: searchEnum(REVIEWS),
  role: searchText(),
  dept: searchText(),
  twostep: searchEnum(["on", "off"]),
  seen: searchEnum(RECENCY),
  look: searchEnum(LOOKS),
});
export type UsersListSearch = z.infer<typeof usersListSearch>;

/** The filters in the address; each narrows the list, and they combine. */
export type PeopleFilters = Omit<UsersListSearch, "action">;

/** Whether a person is in the list the filters and search leave. */
export function matches(user: User, filters: PeopleFilters, now: number): boolean {
  if (filters.status && user.status !== filters.status) return false;
  if (filters.role && !(user.roles ?? []).includes(filters.role)) return false;
  if (filters.dept && department(user) !== filters.dept) return false;
  if (filters.twostep === "on" && !user.mfa_enabled) return false;
  if (filters.twostep === "off" && user.mfa_enabled) return false;
  if (filters.seen && recency(user, now) !== filters.seen) return false;
  if (filters.look && !needsLook(user, filters.look, now)) return false;
  const query = filters.q?.trim().toLowerCase();
  if (query) {
    const fields = [user.display_name, user.email, user.phone, user.id];
    if (!fields.some((field) => field?.toLowerCase().includes(query))) return false;
  }
  return true;
}

/** Each value and how many have it, most first, then by name; blanks aren't counted. */
export function countBy(values: readonly (string | null | undefined)[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** How many people were in the organisation at the end of each of the last `months` months. */
export function growth(users: readonly Pick<User, "created_at">[], now: number, months = 15) {
  const today = new Date(now);
  const joined = users.map((user) => Date.parse(user.created_at)).sort((a, b) => a - b);
  return Array.from({ length: months }, (_, i) => {
    const end = new Date(today.getFullYear(), today.getMonth() - months + 2 + i, 1).getTime();
    let n = 0;
    while (n < joined.length && (joined[n] ?? 0) < end) n++;
    return n;
  });
}

/** The columns the list sorts by, and what each compares. */
export type PeopleSortColumn = "person" | "role" | "active" | "joined";
const SORT_VALUE: Record<PeopleSortColumn, (user: User) => string | number> = {
  person: (user) => personName(user).toLowerCase(),
  role: (user) => (user.roles ?? []).join(", ").toLowerCase(),
  // Never signed in sorts as the longest ago.
  active: (user) => (user.last_seen_at ? Date.parse(user.last_seen_at) : 0),
  joined: (user) => Date.parse(user.created_at),
};

/** The rows in the table's sort; `null` keeps the server's order, newest first. */
export function sortPeople(rows: readonly User[], sort: TableSort | null): User[] {
  const value = sort && SORT_VALUE[sort.column as PeopleSortColumn];
  if (!sort || !value) return [...rows];
  const way = sort.direction === "ascending" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    return (x < y ? -1 : x > y ? 1 : 0) * way;
  });
}
