// The Users list's model: when each person was last active, what about them needs a look, the
// filters in the page address and how the list API asks for them, and, for the two filters it
// doesn't have, how the page works them out itself. Pure, so the page and its tests share it.
import type { TableSort } from "@qeetrix/react";
import type { z } from "zod";

import { createIntentSearch } from "@/shared/hooks/use-create-intent";
import { searchEnum, searchText } from "@/shared/utils/search-params";

import type { User, UserQuery } from "./api/users";

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

/** Whether someone can sign in: All users shows everyone, or one status. */
export const STATUSES = ["active", "suspended"] as const;
/** A suspension's risk and review, as the suspended list filters them. */
export const RISKS = ["high", "medium", "low", "unknown"] as const;
export const REVIEWS = ["pending", "reviewed"] as const;

/**
 * The list's address: `?q=…&status=…&role=…&dept=…&twostep=on|off&seen=…&look=…&group=none`,
 * with `reason`, `risk` and `review` while Suspended is chosen, and `action=create`. `group=none`
 * (people in no group) comes from the Groups page's band; the list has no control for it.
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
  group: searchEnum(["none"]),
});
export type UsersListSearch = z.infer<typeof usersListSearch>;

/** The filters in the address; each narrows the list, and they combine. */
export type PeopleFilters = Omit<UsersListSearch, "action">;

/** Whether a person is in the list the filters and search leave. */
/**
 * The filters, search and sort as the list API's query; null when two of them can't both hold,
 * such as a look and a filter that ask for different last-active times, so no one matches.
 */
export function userQuery(filters: PeopleFilters, sort: TableSort | null): UserQuery | null {
  const query: UserQuery = {};
  const q = filters.q?.trim();
  if (q) query.q = q;
  if (filters.status) query.status = filters.status;
  if (filters.role) query.role = filters.role;
  if (filters.dept) query.department = filters.dept;
  if (filters.twostep) query.mfa = filters.twostep;
  if (filters.seen) query.last_seen = filters.seen;
  if (filters.look === "dormant" || filters.look === "never") {
    const seen = filters.look === "dormant" ? "older" : "never";
    if (query.last_seen && query.last_seen !== seen) return null;
    query.last_seen = seen;
  }
  if (filters.look === "suspended") {
    if (query.status && query.status !== "suspended") return null;
    query.status = "suspended";
  }
  if (filters.look === "unverified") query.email_verified = false;
  if (filters.look === "admins-no-two-step") query.admins_without_mfa = true;
  if (filters.group === "none") query.in_group = false;
  const column = sort && SORT_QUERY[sort.column as PeopleSortColumn];
  if (sort && column) {
    const order = sort.direction === "ascending" ? "asc" : "desc";
    // Newest joined first is the server's own order.
    if (column !== "created" || order !== "desc") Object.assign(query, { sort: column, order });
  }
  return query;
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

/** The columns the list sorts by, and the list API's order for each. */
export type PeopleSortColumn = "person" | "active" | "joined";
const SORT_QUERY: Record<PeopleSortColumn, UserQuery["sort"]> = {
  person: "name",
  active: "last_seen",
  joined: "created",
};
