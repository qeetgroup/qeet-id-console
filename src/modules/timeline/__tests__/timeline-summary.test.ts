import { describe, expect, it } from "vitest";

import type { ActivityEvent } from "@/modules/activity";
import { computeTimelineSummary } from "../timeline-summary";

function event(partial: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: partial.id ?? "evt_1",
    type: partial.type ?? "user.login.succeeded",
    category: partial.category ?? "authentication",
    severity: partial.severity ?? "success",
    title: partial.title ?? "Event",
    at: partial.at ?? "2026-08-15T12:00:00Z",
    ...partial,
  };
}

describe("computeTimelineSummary", () => {
  it("buckets events by category family", () => {
    const summary = computeTimelineSummary([
      event({ id: "1", category: "authentication" }),
      event({ id: "2", category: "mfa" }),
      event({ id: "3", category: "security" }),
      event({ id: "4", category: "authorization" }),
      event({ id: "5", category: "sessions" }),
      event({ id: "6", category: "administration" }),
    ]);
    expect(summary.total).toBe(6);
    expect(summary.authentication).toBe(2);
    expect(summary.security).toBe(2);
    expect(summary.sessions).toBe(1);
    expect(summary.admin).toBe(1);
  });

  it("counts admin actions by actor type as well as category", () => {
    const summary = computeTimelineSummary([
      event({ id: "1", category: "user", actor: { type: "administrator", id: "a1" } }),
      event({ id: "2", category: "user", actor: { type: "user", id: "u1" } }),
    ]);
    expect(summary.admin).toBe(1);
    expect(summary.uniqueActors).toBe(2);
  });

  it("dedupes actors and handles an empty list", () => {
    expect(computeTimelineSummary([]).total).toBe(0);
    const summary = computeTimelineSummary([
      event({ id: "1", actor: { id: "a1" } }),
      event({ id: "2", actor: { id: "a1" } }),
    ]);
    expect(summary.uniqueActors).toBe(1);
  });
});
