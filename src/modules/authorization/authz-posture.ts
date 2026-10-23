// Authorization posture figures derived in the browser from roles, permissions and ABAC
// policies. The backend has no posture score, coverage or history, so these summarise live
// configuration; they are not server verdicts.

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

export type HealthBand = "good" | "fair" | "atRisk";

export interface PolicyHealth {
  score: number; // 0–100
  band: HealthBand;
  critical: number; // Counts of findings, not of the items behind them
  warnings: number;
  info: number;
}

// A finding costs a base amount plus a capped amount per extra item, so ten wildcards read worse
// than one but one noisy check can't zero the score. Info findings describe configuration, not
// risk, so they cost nothing.
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

/** Returns the sorted resource types in permission keys: the part before the first `.` or `:`. */
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

/** Returns how many resource types at least one enabled ABAC policy covers. */
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
  delta: number; // creates minus deletes across the window
  percent: number; // against the count at the start of the window
}

/**
 * Returns an entity's net change over the window from its audit create and delete events, as
 * there are no count snapshots. Returns null when there are none, rather than a flat trend.
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
