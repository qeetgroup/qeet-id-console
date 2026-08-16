// Derive a per-user risk level from the tenant's security anomaly feed.

import type { Anomaly } from "@/modules/security";

export type RiskLevel = "low" | "medium" | "high";

export interface UserRisk {
  level: RiskLevel;
  /** Open (unresolved) anomalies attributed to this user. */
  openCount: number;
}

/**
 * Derive a user's risk level from the tenant anomaly feed: high/critical open
 * anomalies → high, medium → medium, otherwise low. No signals = low (the
 * healthy default), which is honest — anomalies are only written server-side
 * when something abnormal is detected.
 */
export function deriveUserRisk(anomalies: Anomaly[], userId: string): UserRisk {
  const open = anomalies.filter(
    (a) => a.user_id === userId && a.status !== "resolved" && !a.resolved_at,
  );
  if (open.length === 0) return { level: "low", openCount: 0 };
  const hasHigh = open.some((a) => a.severity === "high" || a.severity === "critical");
  const hasMedium = open.some((a) => a.severity === "medium");
  return { level: hasHigh ? "high" : hasMedium ? "medium" : "low", openCount: open.length };
}
