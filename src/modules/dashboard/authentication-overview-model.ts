// Pure derivations for the Authentication overview.
//
// No React, no i18n, no strings: every label is looked up in the view by id, so
// this file is locale-independent and testable without booting anything.

import type { AnalyticsOverview } from "./api/analytics";
import { EMPTY_OVERVIEW } from "./api/analytics";
import type { HealthState } from "./dashboard-insights";
import { MFA_TARGET_PCT } from "./dashboard-insights";

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

/** The five sign-in methods the auth policy can switch on. */
export const SIGN_IN_METHODS = [
  "password_enabled",
  "passkey_enabled",
  "magic_link_enabled",
  "otp_email_enabled",
  "otp_sms_enabled",
] as const;

export type SignInMethod = (typeof SIGN_IN_METHODS)[number];

/**
 * How many sign-in methods are enabled.
 *
 * Deliberately excludes `remember_device_enabled` — that is adaptive MFA
 * (skip the second factor on a known device), not a way to sign in. Counting it
 * would let a tenant appear to have six methods.
 */
export function countSignInMethods(policy?: Partial<Record<SignInMethod, boolean>>): number {
  if (!policy) return 0;
  return SIGN_IN_METHODS.filter((k) => policy[k]).length;
}

export type MfaCoverage = {
  pct: number;
  /**
   * Percentage-POINT change vs 7 days ago, not a percent change and not a
   * 30-day window (`analytics.go:215` diffs against `INTERVAL '7 days'`).
   * Only ever set on the analytics branch — the user-stats fallback has no
   * history, and inventing one is what we set out not to do.
   */
  deltaPp?: number;
  source: "analytics" | "users" | "none";
};

/**
 * MFA coverage, preferring the source that carries a real delta.
 *
 * The two sources disagree on purpose: `analytics.mfa_adoption_pct` counts
 * confirmed TOTP only, while `UserStats.mfa_enabled` counts TOTP or OTP factors
 * or push devices. The users figure is the broader truth; the analytics figure
 * is the only one with a trend. We take analytics when it is really present so
 * the page can show one honest arrow, and fall back to the broader count with
 * no arrow rather than showing a number with a fabricated trend.
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
  /** 0–100 before weighting. */
  score: number;
  weight: number;
  /** Where the matching recommended action sends the operator. */
  to: string;
};

export type AuthPosture = {
  score: number;
  state: HealthState;
  /** Always five, always in comp order. */
  items: AuthPostureItem[];
  /** The failing subset, heaviest first — drives both the badge and the callout. */
  pending: AuthPostureItem[];
};

export type AuthPostureInput = {
  signInMethodsEnabled: number;
  socialEnabled: number;
  ssoConnections: number;
  mfaCoveragePct: number;
  trustedDevices: number;
};

/** Two methods is the threshold: one is a single point of failure for sign-in. */
const SIGN_IN_TARGET = 2;

/**
 * Posture = how completely the authentication surface is set up.
 *
 * Deliberately NOT `computeIdentityHealth`, which scores *operational* health
 * from login success rate and stickiness. A security posture that drops because
 * fewer people signed in today would be wrong, and four of these five checks are
 * configuration facts that `AnalyticsOverview` cannot see at all.
 *
 * One function produces both the checklist and the recommended actions, so the
 * "N pending" badge can never disagree with the ticks above it.
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
      // Heaviest: MFA is the biggest single lever on account takeover.
      id: "mfa",
      score: clamp((input.mfaCoveragePct / MFA_TARGET_PCT) * 100),
      ok: input.mfaCoveragePct >= MFA_TARGET_PCT,
      weight: 0.35,
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

/** Same thresholds as the dashboard's identity health, so grading is consistent. */
export function stateFromScore(score: number): HealthState {
  if (score >= 75) return "healthy";
  if (score >= 50) return "attention";
  return "critical";
}
