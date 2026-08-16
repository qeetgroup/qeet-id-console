// Derived dashboard insights. Every value here is a pure function of the live
// analytics overview (the one payload the dashboard already fetches), so the
// new operations panels never invent numbers — they re-express real telemetry
// as health scores, attention items, and posture signals. Keeping the math out
// of the components makes it testable and honest.

import type { AnalyticsOverview } from "./api/analytics";

export type InsightSeverity = "critical" | "warning" | "info";
export type HealthState = "healthy" | "attention" | "critical";

/** Adoption/engagement targets we grade against. Mirrors the security guidance
 * surfaced elsewhere in the console (MFA is expected to reach 80%+). */
export const MFA_TARGET_PCT = 80;
export const STICKINESS_TARGET_PCT = 40; // DAU/MAU that reads as "great engagement"

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

function successRate(overview: AnalyticsOverview): number {
  const logins = overview.kpis.logins_today.value;
  const failed = overview.kpis.failed_logins_24h.value;
  const total = logins + failed;
  return total > 0 ? (logins / total) * 100 : 100;
}

function healthState(score: number): HealthState {
  if (score >= 75) return "healthy";
  if (score >= 50) return "attention";
  return "critical";
}

// ---------------------------------------------------------------------------
// Identity health — a composite index + per-subsystem breakdown
// ---------------------------------------------------------------------------

export interface HealthArea {
  id: string;
  label: string;
  score: number; // 0-100
  state: HealthState;
}

export interface IdentityHealth {
  score: number; // 0-100 composite
  grade: "Excellent" | "Good" | "Fair" | "At risk";
  areas: HealthArea[];
}

function grade(score: number): IdentityHealth["grade"] {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "At risk";
}

/** Weighted health index. MFA coverage is weighted highest because it's the
 * single biggest lever on account-takeover risk. */
export function computeIdentityHealth(overview: AnalyticsOverview): IdentityHealth {
  const { kpis } = overview;
  const authScore = clamp(successRate(overview));
  const mfaScore = clamp((kpis.mfa_adoption_pct.value / MFA_TARGET_PCT) * 100);
  const engagementScore = clamp((kpis.stickiness_pct.value / STICKINESS_TARGET_PCT) * 100);

  const areas: HealthArea[] = [
    {
      id: "authentication",
      label: "Authentication",
      score: Math.round(authScore),
      state: healthState(authScore),
    },
    { id: "mfa", label: "MFA adoption", score: Math.round(mfaScore), state: healthState(mfaScore) },
    {
      id: "engagement",
      label: "Engagement",
      score: Math.round(engagementScore),
      state: healthState(engagementScore),
    },
  ];

  const score = Math.round(authScore * 0.35 + mfaScore * 0.4 + engagementScore * 0.25);
  return { score, grade: grade(score), areas };
}

// ---------------------------------------------------------------------------
// Attention required — actionable items surfaced from real thresholds
// ---------------------------------------------------------------------------

export interface AttentionItem {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  to: string;
  actionLabel: string;
}

/** Only emits an item when a real signal crosses a threshold — an empty array
 * means the panel shows an "all clear" state rather than manufactured noise. */
export function deriveAttentionItems(overview: AnalyticsOverview): AttentionItem[] {
  const { kpis } = overview;
  const items: AttentionItem[] = [];

  const mfa = kpis.mfa_adoption_pct.value;
  if (mfa < MFA_TARGET_PCT) {
    items.push({
      id: "mfa-adoption",
      severity: mfa < 50 ? "critical" : "warning",
      title: "MFA adoption below target",
      detail: `${mfa.toFixed(1)}% of active users have a second factor — short of the ${MFA_TARGET_PCT}% target.`,
      to: "/authentication",
      actionLabel: "Strengthen MFA",
    });
  }

  const failedDelta = kpis.failed_logins_24h.delta_pct;
  if (failedDelta > 15) {
    items.push({
      id: "failed-logins",
      severity: failedDelta > 40 ? "critical" : "warning",
      title: "Failed sign-ins are rising",
      detail: `Failed authentication attempts are up ${failedDelta.toFixed(1)}% over the last 24 hours.`,
      to: "/security/threats/anomalies",
      actionLabel: "Review anomalies",
    });
  }

  const stickiness = kpis.stickiness_pct.value;
  if (stickiness > 0 && stickiness < 15) {
    items.push({
      id: "engagement",
      severity: "info",
      title: "Daily engagement is low",
      detail: `Only ${stickiness.toFixed(0)}% of monthly users returned today (DAU/MAU).`,
      to: "/analytics",
      actionLabel: "Open analytics",
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Session overview — estimated live footprint from active users
// ---------------------------------------------------------------------------

export interface SessionStat {
  id: string;
  label: string;
  value: string;
  hint?: string;
}

export function deriveSessionStats(overview: AnalyticsOverview): SessionStat[] {
  const { kpis } = overview;
  const active = Math.round(kpis.avg_sessions_per_user.value * kpis.dau.value);
  return [
    {
      id: "active",
      label: "Active sessions",
      value: active.toLocaleString("en-US"),
      hint: "Estimated from daily active users",
    },
    {
      id: "avg",
      label: "Avg sessions / user",
      value: kpis.avg_sessions_per_user.value.toFixed(1),
    },
    {
      id: "dau",
      label: "Daily active users",
      value: kpis.dau.value.toLocaleString("en-US"),
    },
    {
      id: "stickiness",
      label: "Stickiness (DAU/MAU)",
      value: `${kpis.stickiness_pct.value.toFixed(0)}%`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Security posture — real/derived signals with an intent colour
// ---------------------------------------------------------------------------

export interface SecuritySignal {
  id: string;
  label: string;
  value: string;
  intent: "success" | "warning" | "danger";
  delta?: number;
  favorable?: boolean;
}

export function deriveSecuritySignals(overview: AnalyticsOverview): SecuritySignal[] {
  const { kpis } = overview;
  const failed = kpis.failed_logins_24h.value;
  const rate = successRate(overview);
  const mfa = kpis.mfa_adoption_pct.value;

  return [
    {
      id: "failed",
      label: "Failed sign-ins (24h)",
      value: failed.toLocaleString("en-US"),
      intent: failed === 0 ? "success" : failed > 100 ? "danger" : "warning",
      delta: kpis.failed_logins_24h.delta_pct,
      favorable: kpis.failed_logins_24h.delta_pct <= 0,
    },
    {
      id: "success",
      label: "Sign-in success rate",
      value: `${rate.toFixed(1)}%`,
      intent: rate >= 98 ? "success" : rate >= 90 ? "warning" : "danger",
    },
    {
      id: "mfa",
      label: "MFA coverage",
      value: `${mfa.toFixed(1)}%`,
      intent: mfa >= MFA_TARGET_PCT ? "success" : mfa >= 50 ? "warning" : "danger",
    },
  ];
}
