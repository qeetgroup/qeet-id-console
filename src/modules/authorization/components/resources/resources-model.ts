// What protects a resource: the roles that grant an action on it and the policies that name it.

import type { AbacPolicy } from "@/modules/authorization/api/abac";
import type { Permission } from "@/modules/authorization/api/rbac";
import { isUnconditional } from "@/modules/authorization/authz-posture";

export const GUARDS = ["roles", "both", "policies"] as const;
export type Guard = (typeof GUARDS)[number];
// The Users band's ordinal ramp (people.css).
export const SWATCH: Record<Guard, string> = { roles: "today", both: "week", policies: "month" };

/** `?q=…&by=qeet|policy&guard=…&look=off|open`, and `resource=<key>` for the open one. */
export type ResourceFilters = {
  q?: string;
  by?: "qeet" | "policy";
  guard?: Guard;
  look?: "off" | "open";
};

export type ResourceRow = {
  key: string;
  /** Qeet ID's own (from its permission keys), or named only in your policies. */
  source: "qeet" | "policy";
  permissions: Permission[];
  actions: string[];
  /** Roles that grant an action on it. */
  roles: number;
  /** Policies on this resource type (not those on every resource). */
  policies: AbacPolicy[];
};

export const guardOf = (r: ResourceRow): Guard =>
  r.roles === 0 ? "policies" : r.policies.length ? "both" : "roles";

/** An allow that's on and has no condition: it lets everyone through. */
export const isOpenAllow = (p: AbacPolicy) =>
  p.enabled && p.effect === "allow" && isUnconditional(p.condition);
