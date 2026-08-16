import { describe, expect, it } from "vitest";

import {
  arrayToCsv,
  OUTCOME_TO_SEVERITY,
  searchToFilters,
  severityToOutcome,
  validateActivitySearch,
} from "../activity-search";
import type { Severity } from "../types/activity.types";

describe("validateActivitySearch", () => {
  it("drops blank values and passes through valid strings", () => {
    const s = validateActivitySearch({ q: "login", actor: "  ", severity: "error,critical" });
    expect(s.q).toBe("login");
    expect(s.actor).toBeUndefined();
    expect(s.severity).toBe("error,critical");
  });

  it("clamps unknown enums to undefined", () => {
    expect(validateActivitySearch({ range: "bogus" }).range).toBeUndefined();
    expect(validateActivitySearch({ mode: "sideways" }).mode).toBeUndefined();
    expect(validateActivitySearch({ tab: "nope" }).tab).toBeUndefined();
  });

  it("accepts valid enums", () => {
    expect(validateActivitySearch({ range: "24h" }).range).toBe("24h");
    expect(validateActivitySearch({ mode: "history" }).mode).toBe("history");
    expect(validateActivitySearch({ tab: "related" }).tab).toBe("related");
  });

  it("ignores non-string values", () => {
    // biome-ignore lint/suspicious/noExplicitAny: exercising malformed input
    const s = validateActivitySearch({ q: 42 as any, actor: null as any });
    expect(s.q).toBeUndefined();
    expect(s.actor).toBeUndefined();
  });
});

describe("searchToFilters", () => {
  it("splits csv facets into arrays and drops invalid severities", () => {
    const f = searchToFilters({ type: "a,b", severity: "error,bogus,critical", category: "auth" });
    expect(f.types).toEqual(["a", "b"]);
    expect(f.severity).toEqual(["error", "critical"]);
    expect(f.category).toEqual(["auth"]);
  });

  it("defaults scalar facets to empty strings", () => {
    const f = searchToFilters({});
    expect(f.actor).toBe("");
    expect(f.q).toBe("");
    expect(f.ip).toBe("");
    expect(f.from).toBe("");
    expect(f.to).toBe("");
  });

  it("resolves a relative preset to a from window", () => {
    const f = searchToFilters({ range: "24h" });
    expect(f.from).not.toBe("");
    expect(Number.isNaN(Date.parse(f.from))).toBe(false);
  });

  it("resolves a custom range to start/end of the picked days", () => {
    const f = searchToFilters({ range: "custom", from: "2026-01-10T09:00:00.000Z" });
    expect(f.from).not.toBe("");
    // custom windows expand to a full day, so from ≤ to
    expect(f.from <= (f.to || f.from)).toBe(true);
  });
});

describe("outcome ⇄ severity mapping", () => {
  it("maps each outcome to its severity set", () => {
    expect(OUTCOME_TO_SEVERITY.failed).toEqual(["error", "critical"]);
    expect(OUTCOME_TO_SEVERITY.success).toEqual(["success"]);
  });

  it("reverse-maps an exact severity set to an outcome", () => {
    expect(severityToOutcome(["error", "critical"] as Severity[])).toBe("failed");
    expect(severityToOutcome(["critical", "error"] as Severity[])).toBe("failed"); // order-insensitive
    expect(severityToOutcome(["success"] as Severity[])).toBe("success");
  });

  it("returns '' for a non-matching severity set", () => {
    expect(severityToOutcome(["warning", "success"] as Severity[])).toBe("");
    expect(severityToOutcome([])).toBe("");
  });
});

describe("arrayToCsv", () => {
  it("joins non-empty arrays and returns undefined for empty", () => {
    expect(arrayToCsv(["a", "b"])).toBe("a,b");
    expect(arrayToCsv([])).toBeUndefined();
  });
});
