import type { Anomaly } from "@/modules/security";

export type RiskLevel = "low" | "medium" | "high";

export interface UserRisk {
  level: RiskLevel;
  openCount: number; // unresolved anomalies attributed to the user
}

/**
 * Returns a user's risk from their open anomalies: high or critical → high, medium → medium,
 * otherwise low. None at all is low, since the server records an anomaly only when it sees one.
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
