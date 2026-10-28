// Authorization risk checks derived in the browser from permissions and ABAC policies: what the
// Dashboard's Needs attention shows when one is found. The backend has no posture verdicts, so
// these summarise live configuration.

import type { AbacPolicy, ConditionJson } from "./api/abac";
import { type Permission, wildcardPermissions } from "./api/rbac";

export type PostureSeverity = "high" | "medium" | "info";
export type PostureFindingId = "wildcard" | "unconditional" | "disabled" | "deny";

export interface PostureFinding {
  id: PostureFindingId;
  severity: PostureSeverity;
  count: number;
}

/**
 * Whether a stored condition always matches. The server treats a missing condition, `{}` and an
 * empty `all` as no condition at all (abac.evaluateNode), and some policies store `{}`.
 */
export function isUnconditional(condition: ConditionJson | Record<string, never> | null): boolean {
  if (condition == null) return true;
  const keys = Object.keys(condition);
  if (keys.length === 0) return true;
  return "all" in condition && Array.isArray(condition.all) && condition.all.length === 0;
}

/** Returns the four posture checks, in display order. */
export function postureFindings(perms: Permission[], policies: AbacPolicy[]): PostureFinding[] {
  return [
    { id: "wildcard", severity: "high", count: wildcardPermissions(perms).length },
    {
      id: "unconditional",
      severity: "medium",
      count: policies.filter(
        (p) => p.enabled && p.effect === "allow" && isUnconditional(p.condition),
      ).length,
    },
    { id: "disabled", severity: "info", count: policies.filter((p) => !p.enabled).length },
    { id: "deny", severity: "info", count: policies.filter((p) => p.effect === "deny").length },
  ];
}
