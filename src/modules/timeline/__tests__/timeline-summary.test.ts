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
  it("buckets events by the server's categories", () => {
    const summary = computeTimelineSummary([
      event({ id: "1", category: "authentication" }),
      event({ id: "2", category: "security" }),
      event({ id: "3", category: "authorization" }),
      event({ id: "4", category: "directory" }),
      event({ id: "5", category: "developer" }),
      event({ id: "6", category: "system" }),
    ]);
    expect(summary).toMatchObject({
      total: 6,
      authentication: 1,
      security: 2,
      directory: 1,
      developer: 2,
    });
  });

  it("leaves a category the server doesn't send out of every card", () => {
    const summary = computeTimelineSummary([event({ id: "1", category: "provisioning" })]);
    expect(summary).toMatchObject({
      total: 1,
      authentication: 0,
      security: 0,
      directory: 0,
      developer: 0,
    });
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
