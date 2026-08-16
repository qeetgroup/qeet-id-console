import { describe, expect, it } from "vitest";

import { type AnalyticsOverview, EMPTY_OVERVIEW } from "./api/analytics";
import {
  computeIdentityHealth,
  deriveAttentionItems,
  deriveSecuritySignals,
  deriveSessionStats,
} from "./dashboard-insights";

/** Build an overview with specific KPI values, defaulting the rest to empty. */
function overview(kpis: Partial<AnalyticsOverview["kpis"]>): AnalyticsOverview {
  return { ...EMPTY_OVERVIEW, kpis: { ...EMPTY_OVERVIEW.kpis, ...kpis } };
}
const metric = (value: number, delta_pct = 0) => ({ value, delta_pct });

describe("computeIdentityHealth", () => {
  it("grades a healthy tenant highly", () => {
    const health = computeIdentityHealth(
      overview({
        logins_today: metric(1000),
        failed_logins_24h: metric(5),
        mfa_adoption_pct: metric(90),
        stickiness_pct: metric(40),
      }),
    );
    expect(health.score).toBeGreaterThanOrEqual(85);
    expect(health.grade).toBe("Excellent");
    expect(health.areas.find((a) => a.id === "mfa")?.state).toBe("healthy");
  });

  it("flags low MFA coverage as a critical subsystem", () => {
    const health = computeIdentityHealth(overview({ mfa_adoption_pct: metric(20) }));
    expect(health.areas.find((a) => a.id === "mfa")?.state).toBe("critical");
  });

  it("keeps the composite score within 0-100", () => {
    const health = computeIdentityHealth(
      overview({ mfa_adoption_pct: metric(999), stickiness_pct: metric(999) }),
    );
    expect(health.score).toBeLessThanOrEqual(100);
    expect(health.score).toBeGreaterThanOrEqual(0);
  });
});

describe("deriveAttentionItems", () => {
  it("stays silent when every signal is healthy", () => {
    const items = deriveAttentionItems(
      overview({
        mfa_adoption_pct: metric(85),
        failed_logins_24h: metric(3, 0),
        stickiness_pct: metric(30),
      }),
    );
    expect(items).toEqual([]);
  });

  it("escalates MFA severity below 50%", () => {
    const items = deriveAttentionItems(overview({ mfa_adoption_pct: metric(30) }));
    const mfa = items.find((i) => i.id === "mfa-adoption");
    expect(mfa?.severity).toBe("critical");
  });

  it("surfaces rising failed sign-ins", () => {
    const items = deriveAttentionItems(
      overview({ mfa_adoption_pct: metric(90), failed_logins_24h: metric(500, 42) }),
    );
    const failed = items.find((i) => i.id === "failed-logins");
    expect(failed?.severity).toBe("critical");
  });
});

describe("deriveSessionStats & deriveSecuritySignals", () => {
  it("estimates active sessions from active users", () => {
    const stats = deriveSessionStats(
      overview({ avg_sessions_per_user: metric(2), dau: metric(1500) }),
    );
    expect(stats.find((s) => s.id === "active")?.value).toBe("3,000");
  });

  it("marks a clean security posture as success", () => {
    const signals = deriveSecuritySignals(
      overview({
        logins_today: metric(1000),
        failed_logins_24h: metric(0),
        mfa_adoption_pct: metric(95),
      }),
    );
    expect(signals.every((s) => s.intent === "success")).toBe(true);
  });
});
