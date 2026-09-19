// Posture maths for the Authorization overview.
//
// Everything here is derived in the browser from configuration the API already
// returns — roles, permissions and ABAC policies. The backend exposes no
// posture score, no resource-coverage figure and no historical counts, so these
// are presentation-level summaries of live config, not server verdicts. Keep
// them pure and testable: the route only renders what these functions return.

import type { AbacPolicy } from "./api/abac";
import type { AuditEvent } from "./api/audit";
import { type Permission, wildcardPermissions } from "./api/rbac";

export type PostureSeverity = "high" | "medium" | "info";
export type PostureFindingId = "wildcard" | "unconditional" | "disabled" | "deny";

export interface PostureFinding {
  id: PostureFindingId;
  severity: PostureSeverity;
  count: number;
}

/** The four checks the overview reports on, in display order. */
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

export type HealthBand = "good" | "fair" | "atRisk";

export interface PolicyHealth {
  /** 0–100. */
  score: number;
  band: HealthBand;
  /** Number of *findings* (not items) at each level. */
  critical: number;
  warnings: number;
  info: number;
}

// Deduction weights. A finding costs a base amount for existing at all, plus a
// smaller amount per extra item so ten wildcards read worse than one — capped so
// a single noisy check can't zero the score on its own. Info-level findings
// (disabled and deny policies) are reported but never deducted: they describe
// configuration, not risk.
const BASE_DEDUCTION: Record<PostureSeverity, number> = { high: 15, medium: 8, info: 0 };
const PER_EXTRA_ITEM: Record<PostureSeverity, number> = { high: 3, medium: 2, info: 0 };
const MAX_EXTRA_ITEMS = 5;

export function policyHealth(findings: PostureFinding[]): PolicyHealth {
  let score = 100;
  let critical = 0;
  let warnings = 0;
  let info = 0;

  for (const finding of findings) {
    if (finding.count === 0) continue;
    if (finding.severity === "high") critical += 1;
    else if (finding.severity === "medium") warnings += 1;
    else info += 1;

    const extras = Math.min(finding.count - 1, MAX_EXTRA_ITEMS);
    score -= BASE_DEDUCTION[finding.severity] + extras * PER_EXTRA_ITEM[finding.severity];
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const band: HealthBand = score >= 85 ? "good" : score >= 60 ? "fair" : "atRisk";
  return { score, band, critical, warnings, info };
}

/**
 * Resource types, taken from permission keys the way the Resources page does
 * it: the part before the first separator ("projects:read" → "projects").
 */
export function resourceTypes(perms: Permission[]): string[] {
  const seen = new Set<string>();
  for (const p of perms) {
    const match = /^[^.:]+/.exec(p.key.trim());
    if (match?.[0]) seen.add(match[0]);
  }
  return [...seen].sort();
}

export interface ResourceCoverage {
  total: number;
  protected: number;
  unprotected: number;
  percent: number;
}

/** How many resource types an enabled ABAC policy actually covers. */
export function resourceCoverage(perms: Permission[], policies: AbacPolicy[]): ResourceCoverage {
  const total = resourceTypes(perms);
  const enabled = policies.filter((p) => p.enabled);
  // A policy on "*" is a tenant-wide rule, so it covers every resource type.
  const coversEverything = enabled.some((p) => p.resource_type.trim() === "*");
  const covered = new Set(enabled.map((p) => p.resource_type.trim()));

  const protectedCount = coversEverything
    ? total.length
    : total.filter((type) => covered.has(type)).length;

  return {
    total: total.length,
    protected: protectedCount,
    unprotected: total.length - protectedCount,
    percent: total.length === 0 ? 0 : Math.round((protectedCount / total.length) * 100),
  };
}

export interface CountTrend {
  /** Net change across the window (creates minus deletes). */
  delta: number;
  /** Change against the count at the start of the window. */
  percent: number;
}

/**
 * Reconstructs a trend from the audit log, which is the only record of what
 * changed: there are no historical count snapshots. Returns null when the
 * window holds no create/delete events for the entity — the caller shows no
 * trend at all rather than implying a flat line it cannot evidence.
 */
export function auditTrend(
  events: AuditEvent[],
  entity: "role" | "abac_policy",
  current: number,
): CountTrend | null {
  let created = 0;
  let deleted = 0;
  for (const event of events) {
    if (event.action === `${entity}.created`) created += 1;
    else if (event.action === `${entity}.deleted`) deleted += 1;
  }
  if (created === 0 && deleted === 0) return null;

  const delta = created - deleted;
  const baseline = current - delta;
  const percent = baseline > 0 ? Math.round((delta / baseline) * 100) : delta > 0 ? 100 : 0;
  return { delta, percent };
}
