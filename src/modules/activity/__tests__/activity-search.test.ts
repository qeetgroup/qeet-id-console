import { describe, expect, it } from "vitest";

import { buildActivityQuery, minimumSeverity } from "../activity-history";
import {
  activitySearchSchema,
  arrayToCsv,
  rangeOf,
  searchToFilters,
  severityList,
  tabOf,
} from "../activity-search";
import { DEFAULT_FILTERS } from "../types/activity.types";

describe("activitySearchSchema", () => {
  it("drops blank values and passes through valid strings", () => {
    const s = activitySearchSchema.parse({ q: "login", actor: "  ", severity: "error,critical" });
    expect(s.q).toBe("login");
    expect(s.actor).toBeUndefined();
    expect(s.severity).toBe("error,critical");
  });

  it("drops an unknown range, and the old all-time one", () => {
    expect(activitySearchSchema.parse({ range: "bogus" }).range).toBeUndefined();
    expect(activitySearchSchema.parse({ range: "all" }).range).toBeUndefined();
    expect(activitySearchSchema.parse({ range: "90d" }).range).toBe("90d");
  });

  it("keeps the links other pages make: one event on its day, a resource since a date", () => {
    const s = activitySearchSchema.parse({
      range: "custom",
      from: "2026-10-26T00:00:00.000Z",
      to: "2026-10-26T23:59:59.999Z",
      event: "e1",
      resource: "tenant",
    });
    expect(s).toEqual({
      range: "custom",
      from: "2026-10-26T00:00:00.000Z",
      to: "2026-10-26T23:59:59.999Z",
      event: "e1",
      resource: "tenant",
    });
  });

  it("drops the old mode and drawer-tab params", () => {
    expect(activitySearchSchema.parse({ mode: "history", tab: "raw" })).toEqual({});
  });

  it("ignores non-string values", () => {
    const s = activitySearchSchema.parse({ q: 42, actor: null });
    expect(s.q).toBeUndefined();
    expect(s.actor).toBeUndefined();
  });
});

describe("searchToFilters", () => {
  it("splits csv facets into arrays and keeps known severities, lowest first", () => {
    const f = searchToFilters({ type: "a,b", severity: "critical,bogus,error", category: "auth" });
    expect(f.types).toEqual(["a", "b"]);
    expect(f.severity).toEqual(["error", "critical"]);
    expect(f.category).toEqual(["auth"]);
  });

  it("covers the last 24 hours when no range is given", () => {
    const before = Date.now();
    const f = searchToFilters({});
    const from = Date.parse(f.from);
    expect(from).toBeGreaterThanOrEqual(before - 86_400_000 - 1000);
    expect(from).toBeLessThanOrEqual(Date.now() - 86_400_000 + 1000);
    expect(f.to).toBe("");
  });

  it("keeps a custom range's exact moments", () => {
    const f = searchToFilters({
      range: "custom",
      from: "2026-01-10T09:00:00.000Z",
      to: "2026-01-11T09:00:00.000Z",
    });
    expect(f.from).toBe("2026-01-10T09:00:00.000Z");
    expect(f.to).toBe("2026-01-11T09:00:00.000Z");
  });

  it("falls back to the default range for a custom one without a valid start", () => {
    expect(rangeOf({ range: "custom" })).toBe("24h");
    expect(rangeOf({ range: "custom", from: "not a date" })).toBe("24h");
    expect(rangeOf({ range: "custom", from: "2026-01-10T09:00:00Z" })).toBe("custom");
  });
});

describe("tabs", () => {
  it("reads Failed and Critical from the severity param, in any order", () => {
    expect(tabOf("error,critical")).toBe("failed");
    expect(tabOf("critical,error")).toBe("failed");
    expect(tabOf("critical")).toBe("critical");
    expect(tabOf(undefined)).toBe("all");
    expect(tabOf("warning")).toBe("all");
  });

  it("lists severities lowest first", () => {
    expect(severityList("critical,warning")).toEqual(["warning", "critical"]);
  });
});

describe("buildActivityQuery", () => {
  it("sends the lowest chosen severity, which the server reads as a minimum", () => {
    expect(minimumSeverity(["error", "critical"])).toBe("error");
    expect(minimumSeverity([])).toBeUndefined();
    const q = buildActivityQuery({ ...DEFAULT_FILTERS, severity: ["warning"] }, "");
    expect(q.severity).toBe("warning");
  });

  it("sends one category, and leaves several to the browser", () => {
    expect(buildActivityQuery({ ...DEFAULT_FILTERS, category: ["security"] }, "").category).toBe(
      "security",
    );
    expect(
      buildActivityQuery({ ...DEFAULT_FILTERS, category: ["security", "system"] }, "").category,
    ).toBeUndefined();
  });

  it("never sends the filters only the browser applies", () => {
    const q = buildActivityQuery({ ...DEFAULT_FILTERS, ip: "1.2.3.4", resource: "tenant" }, "c1");
    expect(q).not.toHaveProperty("ip");
    expect(q).not.toHaveProperty("resource");
    expect(q.cursor).toBe("c1");
  });
});

describe("arrayToCsv", () => {
  it("joins non-empty arrays and returns undefined for empty", () => {
    expect(arrayToCsv(["a", "b"])).toBe("a,b");
    expect(arrayToCsv([])).toBeUndefined();
  });
});
