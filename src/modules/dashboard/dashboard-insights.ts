// Pure functions of the analytics overview: health scores, attention items and posture signals
// that re-express real telemetry rather than invent numbers. Copy is returned as catalogue keys
// (with their values), so the panels translate it at render.

import type { AnalyticsOverview } from "./api/analytics";
import { formatLocale, type TranslationKey } from "@/i18n";

export type InsightSeverity = "critical" | "warning" | "info";
export type HealthState = "healthy" | "attention" | "critical";

export const MFA_TARGET_PCT = 80; // % of users with a second factor
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

export interface HealthArea {
  id: string;
  label: TranslationKey;
  score: number; // 0–100
  state: HealthState;
}

export interface IdentityHealth {
  score: number; // 0–100 composite
  grade: "excellent" | "good" | "fair" | "atRisk";
  areas: HealthArea[];
}

function grade(score: number): IdentityHealth["grade"] {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "atRisk";
}

/**
 * Returns a weighted health index of sign-in success, MFA adoption and engagement. MFA weighs most:
 * it is the biggest single lever on account-takeover risk.
 */
export function computeIdentityHealth(overview: AnalyticsOverview): IdentityHealth {
  const { kpis } = overview;
  const authScore = clamp(successRate(overview));
  const mfaScore = clamp((kpis.mfa_adoption_pct.value / MFA_TARGET_PCT) * 100);
  const engagementScore = clamp((kpis.stickiness_pct.value / STICKINESS_TARGET_PCT) * 100);

  const areas: HealthArea[] = [
    {
      id: "authentication",
      label: "dashboard:insights.areas.authentication",
      score: Math.round(authScore),
      state: healthState(authScore),
    },
    {
      id: "mfa",
      label: "dashboard:insights.areas.mfa",
      score: Math.round(mfaScore),
      state: healthState(mfaScore),
    },
    {
      id: "engagement",
      label: "dashboard:insights.areas.engagement",
      score: Math.round(engagementScore),
      state: healthState(engagementScore),
    },
  ];

  const score = Math.round(authScore * 0.35 + mfaScore * 0.4 + engagementScore * 0.25);
  return { score, grade: grade(score), areas };
}

export interface AttentionItem {
  id: string;
  severity: InsightSeverity;
  title: TranslationKey;
  detail: TranslationKey; // interpolated with `params`
  params: Record<string, string | number>;
  to: string;
  actionLabel: TranslationKey;
}

/**
 * Returns an item only for a signal past its threshold; an empty array renders the panel's
 * "all clear" state rather than manufactured noise.
 */
export function deriveAttentionItems(overview: AnalyticsOverview): AttentionItem[] {
  const { kpis } = overview;
  const items: AttentionItem[] = [];

  const mfa = kpis.mfa_adoption_pct.value;
  if (mfa < MFA_TARGET_PCT) {
    items.push({
      id: "mfa-adoption",
      severity: mfa < 50 ? "critical" : "warning",
      title: "dashboard:insights.attention.mfaAdoption.title",
      detail: "dashboard:insights.attention.mfaAdoption.detail",
      params: { pct: mfa.toFixed(1), target: MFA_TARGET_PCT },
      to: "/settings/organization/security-policy",
      actionLabel: "dashboard:insights.attention.mfaAdoption.action",
    });
  }

  const failedDelta = kpis.failed_logins_24h.delta_pct;
  if (failedDelta > 15) {
    items.push({
      id: "failed-logins",
      severity: failedDelta > 40 ? "critical" : "warning",
      title: "dashboard:insights.attention.failedLogins.title",
      detail: "dashboard:insights.attention.failedLogins.detail",
      params: { pct: failedDelta.toFixed(1) },
      to: "/security/threats/anomalies",
      actionLabel: "dashboard:insights.attention.failedLogins.action",
    });
  }

  const stickiness = kpis.stickiness_pct.value;
  if (stickiness > 0 && stickiness < 15) {
    items.push({
      id: "engagement",
      severity: "info",
      title: "dashboard:insights.attention.engagement.title",
      detail: "dashboard:insights.attention.engagement.detail",
      params: { pct: stickiness.toFixed(0) },
      to: "/analytics",
      actionLabel: "dashboard:insights.attention.engagement.action",
    });
  }

  return items;
}

export interface SessionStat {
  id: string;
  label: TranslationKey;
  value: string;
  hint?: TranslationKey;
}

export function deriveSessionStats(overview: AnalyticsOverview): SessionStat[] {
  const { kpis } = overview;
  const active = Math.round(kpis.avg_sessions_per_user.value * kpis.dau.value);
  return [
    {
      id: "active",
      label: "dashboard:insights.sessions.active",
      value: active.toLocaleString(formatLocale()),
      hint: "dashboard:insights.sessions.activeHint",
    },
    {
      id: "avg",
      label: "dashboard:insights.sessions.avg",
      value: kpis.avg_sessions_per_user.value.toFixed(1),
    },
    {
      id: "dau",
      label: "dashboard:insights.sessions.dau",
      value: kpis.dau.value.toLocaleString(formatLocale()),
    },
    {
      id: "stickiness",
      label: "dashboard:insights.sessions.stickiness",
      value: `${kpis.stickiness_pct.value.toFixed(0)}%`,
    },
  ];
}

export interface SecuritySignal {
  id: string;
  label: TranslationKey;
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
      label: "dashboard:insights.signals.failed",
      value: failed.toLocaleString(formatLocale()),
      intent: failed === 0 ? "success" : failed > 100 ? "danger" : "warning",
      delta: kpis.failed_logins_24h.delta_pct,
      favorable: kpis.failed_logins_24h.delta_pct <= 0,
    },
    {
      id: "success",
      label: "dashboard:insights.signals.success",
      value: `${rate.toFixed(1)}%`,
      intent: rate >= 98 ? "success" : rate >= 90 ? "warning" : "danger",
    },
    {
      id: "mfa",
      label: "dashboard:insights.signals.mfa",
      value: `${mfa.toFixed(1)}%`,
      intent: mfa >= MFA_TARGET_PCT ? "success" : mfa >= 50 ? "warning" : "danger",
    },
  ];
}
