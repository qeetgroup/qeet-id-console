// Authorization risk checks derived in the browser from permissions and ABAC policies: what the
// Dashboard's Needs attention shows when one is found. The backend has no posture verdicts, so
// these summarise live configuration.

import type { AbacPolicy } from "./api/abac";
import { type Permission, wildcardPermissions } from "./api/rbac";

export type PostureSeverity = "high" | "medium" | "info";
export type PostureFindingId = "wildcard" | "unconditional" | "disabled" | "deny";

export interface PostureFinding {
  id: PostureFindingId;
  severity: PostureSeverity;
  count: number;
}

/** Returns the four posture checks, in display order. */
export function postureFindings(perms: Permission[], policies: AbacPolicy[]): PostureFinding[] {
  return [
    { id: "wildcard", severity: "high", count: wildcardPermissions(perms).length },
    {
      id: "unconditional",
      severity: "medium",
      count: policies.filter((p) => p.enabled && p.effect === "allow" && p.condition == null)
        .length,
    },
    { id: "disabled", severity: "info", count: policies.filter((p) => !p.enabled).length },
    { id: "deny", severity: "info", count: policies.filter((p) => p.effect === "deny").length },
  ];
}
