import { describe, expect, it } from "vitest";

import type { HealthIncident } from "../api/service-health";
import {
  componentOf,
  HEALTH_REASONS,
  incidentTone,
  REASON_LABEL,
  reasonOf,
  splitIncidents,
  stateOf,
} from "../service-health-model";

const incident = (id: string, started_at: string, resolved_at: string | null): HealthIncident => ({
  id,
  component: "api",
  impact: "degraded",
  title: id,
  started_at,
  resolved_at,
});

describe("service health model", () => {
  it("words only the states, parts and reasons it knows", () => {
    expect(stateOf("degraded")).toBe("degraded");
    expect(stateOf("not_configured")).toBe("not_configured");
    expect(stateOf("on_fire")).toBe("unknown");
    expect(componentOf("sign_in")).toBe("sign_in");
    expect(componentOf("billing")).toBe("other");
    expect(reasonOf("email.failing")).toBe("email.failing");
    expect(reasonOf("something.new")).toBeUndefined();
    expect(reasonOf(undefined)).toBeUndefined();
  });

  it("has words for every reason", () => {
    expect(Object.keys(REASON_LABEL).sort()).toEqual([...HEALTH_REASONS].sort());
  });

  it("lets an incident's impact pick its alert", () => {
    expect(incidentTone("outage")).toBe("danger");
    expect(incidentTone("degraded")).toBe("warning");
    expect(incidentTone("maintenance")).toBe("info");
    expect(incidentTone("something.new")).toBe("info");
  });

  it("puts open incidents first by start, then resolved ones by when they ended, newest first", () => {
    const { open, resolved } = splitIncidents([
      incident("old-resolved", "2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z"),
      incident("older-open", "2026-11-10T00:00:00Z", null),
      incident("new-resolved", "2026-11-05T00:00:00Z", "2026-11-18T00:00:00Z"),
      incident("newer-open", "2026-11-20T00:00:00Z", null),
    ]);
    expect(open.map((i) => i.id)).toEqual(["newer-open", "older-open"]);
    expect(resolved.map((i) => i.id)).toEqual(["new-resolved", "old-resolved"]);
  });
});
