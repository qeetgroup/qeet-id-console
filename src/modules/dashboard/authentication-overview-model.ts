// Pure derivations for the Authentication overview. No React and no strings: the view looks up
// every label by id, so this stays locale-independent and testable in isolation.

import type { AnalyticsOverview } from "./api/analytics";
import { EMPTY_OVERVIEW } from "./api/analytics";
import type { HealthState } from "./dashboard-insights";
import { MFA_TARGET_PCT } from "./dashboard-insights";

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

/**
 * The sign-in methods the auth policy can switch on. Email and SMS one-time codes are excluded: no
 * such sign-in exists and the server refuses to enable them.
 */
export const SIGN_IN_METHODS = [
  "password_enabled",
  "passkey_enabled",
  "magic_link_enabled",
] as const;

export type SignInMethod = (typeof SIGN_IN_METHODS)[number];

/**
 * Returns how many sign-in methods are enabled. Excludes `remember_device_enabled`: skipping the
 * second factor on a known device is not a way to sign in.
 */
export function countSignInMethods(policy?: Partial<Record<SignInMethod, boolean>>): number {
  if (!policy) return 0;
  return SIGN_IN_METHODS.filter((k) => policy[k]).length;
}

export type MfaCoverage = {
  pct: number;
  deltaPp?: number; // percentage-point change over 7 days; only analytics has history
  source: "analytics" | "users" | "none";
};

/**
 * Returns MFA coverage, preferring analytics (confirmed TOTP only, but with a trend) over user
 * stats (any TOTP, OTP or push factor, no trend), so the page never shows a fabricated trend.
 */
export function resolveMfaCoverage(
  analytics?: AnalyticsOverview,
  stats?: { total: number; mfa_enabled: number },
): MfaCoverage {
  // EMPTY_OVERVIEW is the degraded sentinel returned on 404/501, not real data.
  const isSentinel = !analytics || analytics.generated_at === EMPTY_OVERVIEW.generated_at;
  if (!isSentinel && analytics) {
    const m = analytics.kpis.mfa_adoption_pct;
    return { pct: clamp(m.value), deltaPp: m.delta_pct, source: "analytics" };
  }
  if (stats && stats.total > 0) {
    return { pct: clamp((stats.mfa_enabled / stats.total) * 100), source: "users" };
  }
  return { pct: 0, source: "none" };
}

export type AuthPostureId = "signin" | "social" | "mfa" | "sso" | "devices";

export type AuthPostureItem = {
  id: AuthPostureId;
  ok: boolean;
  score: number; // 0–100, before weighting
  weight: number;
  to: string; // where the matching recommended action leads
};

export type AuthPosture = {
  score: number;
  state: HealthState;
  items: AuthPostureItem[]; // all five checks, in display order
  pending: AuthPostureItem[]; // failing checks, heaviest first; drives badge and callout
};

export type AuthPostureInput = {
  signInMethodsEnabled: number;
  socialEnabled: number;
  ssoConnections: number;
  mfaCoveragePct: number;
  trustedDevices: number;
};

const SIGN_IN_TARGET = 2; // one method is a single point of failure for sign-in

/**
 * Scores how completely authentication is configured. Unlike `computeIdentityHealth` it ignores
 * sign-in traffic, so posture never drops on a quiet day. The checklist and recommended actions
 * share these items, so the "N pending" badge always matches the ticks.
 */
export function deriveAuthPosture(input: AuthPostureInput): AuthPosture {
  const items: AuthPostureItem[] = [
    {
      id: "signin",
      score: clamp((input.signInMethodsEnabled / SIGN_IN_TARGET) * 100),
      ok: input.signInMethodsEnabled >= SIGN_IN_TARGET,
      weight: 0.2,
      to: "/auth/login-methods/password",
    },
    {
      id: "social",
      score: input.socialEnabled > 0 ? 100 : 0,
      ok: input.socialEnabled > 0,
      weight: 0.15,
      to: "/auth/social",
    },
    {
      id: "mfa",
      score: clamp((input.mfaCoveragePct / MFA_TARGET_PCT) * 100),
      ok: input.mfaCoveragePct >= MFA_TARGET_PCT,
      weight: 0.35, // heaviest: MFA is the biggest single lever on account takeover
      to: "/auth/mfa/totp",
    },
    {
      id: "sso",
      score: input.ssoConnections > 0 ? 100 : 0,
      ok: input.ssoConnections > 0,
      weight: 0.15,
      to: "/auth/connections/saml",
    },
    {
      id: "devices",
      score: input.trustedDevices > 0 ? 100 : 0,
      ok: input.trustedDevices > 0,
      weight: 0.15,
      to: "/security/device-authorizations",
    },
  ];

  const score = Math.round(items.reduce((sum, i) => sum + i.score * i.weight, 0));
  return {
    score: clamp(score),
    state: stateFromScore(score),
    items,
    pending: items.filter((i) => !i.ok).sort((a, b) => b.weight - a.weight),
  };
}

/** Grades a 0–100 score with the same thresholds as the dashboard's identity health. */
export function stateFromScore(score: number): HealthState {
  if (score >= 75) return "healthy";
  if (score >= 50) return "attention";
  return "critical";
}
