import { describe, expect, it } from "vitest";

import { EMPTY_OVERVIEW } from "../api/analytics";
import {
  countSignInMethods,
  deriveAuthPosture,
  resolveMfaCoverage,
} from "../authentication-overview-model";

function analytics(pct: number, delta: number) {
  return {
    ...EMPTY_OVERVIEW,
    generated_at: new Date().toISOString(),
    kpis: { ...EMPTY_OVERVIEW.kpis, mfa_adoption_pct: { value: pct, delta_pct: delta } },
  };
}

const CONFIGURED = {
  signInMethodsEnabled: 3,
  socialEnabled: 2,
  ssoConnections: 1,
  mfaCoveragePct: 85,
  trustedDevices: 12,
};
const GREENFIELD = {
  signInMethodsEnabled: 0,
  socialEnabled: 0,
  ssoConnections: 0,
  mfaCoveragePct: 0,
  trustedDevices: 0,
};

describe("countSignInMethods", () => {
  it("counts only the five sign-in toggles", () => {
    expect(
      countSignInMethods({ password_enabled: true, passkey_enabled: true, otp_sms_enabled: true }),
    ).toBe(3);
  });

  it("does not count remember-device as a sign-in method", () => {
    // Adaptive MFA skips the second factor on a known device; it is not a way
    // to sign in, and counting it would show six methods out of five.
    expect(
      countSignInMethods({
        password_enabled: true,
        remember_device_enabled: true,
      } as Parameters<typeof countSignInMethods>[0]),
    ).toBe(1);
  });

  it("returns 0 when the policy hasn't loaded", () => {
    expect(countSignInMethods(undefined)).toBe(0);
  });
});

describe("resolveMfaCoverage", () => {
  it("prefers analytics and carries its delta", () => {
    const got = resolveMfaCoverage(analytics(68, 4.2), { total: 100, mfa_enabled: 80 });
    expect(got).toEqual({ pct: 68, deltaPp: 4.2, source: "analytics" });
  });

  it("falls back to user stats with NO delta when analytics is the degraded sentinel", () => {
    // This is the assertion that enforces "arrows only where real": the
    // fallback has no history, so it must not produce a trend.
    const got = resolveMfaCoverage(EMPTY_OVERVIEW, { total: 200, mfa_enabled: 50 });
    expect(got.source).toBe("users");
    expect(got.pct).toBe(25);
    expect(got.deltaPp).toBeUndefined();
  });

  it("reports nothing when neither source is available", () => {
    expect(resolveMfaCoverage(undefined, undefined)).toEqual({ pct: 0, source: "none" });
  });

  it("does not divide by zero on a tenant with no users", () => {
    expect(resolveMfaCoverage(EMPTY_OVERVIEW, { total: 0, mfa_enabled: 0 }).pct).toBe(0);
  });
});

describe("deriveAuthPosture", () => {
  it("scores a fully configured tenant as healthy with nothing pending", () => {
    const got = deriveAuthPosture(CONFIGURED);
    expect(got.score).toBeGreaterThanOrEqual(90);
    expect(got.state).toBe("healthy");
    expect(got.pending).toEqual([]);
  });

  it("scores a greenfield tenant at zero with everything pending", () => {
    const got = deriveAuthPosture(GREENFIELD);
    expect(got.score).toBe(0);
    expect(got.state).toBe("critical");
    expect(got.pending).toHaveLength(5);
  });

  it("always returns five items in comp order", () => {
    for (const input of [CONFIGURED, GREENFIELD]) {
      expect(deriveAuthPosture(input).items.map((i) => i.id)).toEqual([
        "signin",
        "social",
        "mfa",
        "sso",
        "devices",
      ]);
    }
  });

  it("puts MFA first in pending, because it carries the most weight", () => {
    const got = deriveAuthPosture({ ...CONFIGURED, mfaCoveragePct: 10, socialEnabled: 0 });
    expect(got.pending[0].id).toBe("mfa");
  });

  it("keeps the badge count and the checklist in sync", () => {
    // The "N pending" badge and the ticks are rendered from the same object, so
    // this invariant is what stops them ever disagreeing.
    for (const input of [CONFIGURED, GREENFIELD, { ...CONFIGURED, ssoConnections: 0 }]) {
      const got = deriveAuthPosture(input);
      expect(got.items.filter((i) => !i.ok)).toHaveLength(got.pending.length);
    }
  });

  it("treats MFA at the target as met, and clamps absurd input", () => {
    expect(deriveAuthPosture({ ...GREENFIELD, mfaCoveragePct: 80 }).items[2].ok).toBe(true);
    expect(deriveAuthPosture({ ...CONFIGURED, mfaCoveragePct: 999 }).score).toBeLessThanOrEqual(
      100,
    );
  });
});
