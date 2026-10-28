import { describe, expect, it } from "vitest";
import "@/i18n";

import { bucketWords, eventActor, fillSeries, firstName, knownTotal } from "../activity-view";
import { dayOf, presetToRange, rangeToWindow, windowToRange } from "../time-range";
import { type ActivitySummary, DEFAULT_FILTERS } from "../types/activity.types";

const SUMMARY: ActivitySummary = {
  total: 197,
  unique_actors: 34,
  security_alerts: 1,
  by_severity: { critical: 1, error: 56, info: 44, success: 95, warning: 1 },
  by_category: {
    authentication: 193,
    authorization: 0,
    developer: 1,
    directory: 1,
    security: 2,
    system: 0,
  },
  by_outcome: { failed: 57, info: 44, success: 95, warning: 1 },
  series: [
    {
      at: "2026-10-26T10:00:00Z",
      count: 4,
      success: 2,
      warning: 0,
      failed: 2,
      info: 0,
      critical: 0,
    },
    {
      at: "2026-10-26T12:00:00Z",
      count: 1,
      success: 1,
      warning: 0,
      failed: 0,
      info: 0,
      critical: 0,
    },
  ],
  bucket_seconds: 3600,
  window: { from: "2026-10-26T09:30:00Z", to: "2026-10-26T12:30:00Z" },
};

describe("eventActor", () => {
  it("names a person by their name", () => {
    expect(eventActor({ actor: { id: "u1", name: "Priya Nair", type: "user" } })).toMatchObject({
      name: "Priya Nair",
      personId: "u1",
      system: false,
    });
  });

  it("says Qeet ID acted for a person when the request had no one signed in", () => {
    const actor = eventActor({ actor: { id: "u1", name: "Mareedu Saibabu", type: "system" } });
    expect(actor).toMatchObject({ name: "Qeet ID", personName: "Mareedu Saibabu", system: true });
    expect(actor.note).toBe("for Mareedu Saibabu");
  });

  it("names other actors by their kind", () => {
    expect(eventActor({ actor: { type: "api_key" } })).toMatchObject({ name: "API key" });
    expect(eventActor({ actor: { type: "anonymous" } }).name).toBe("Not signed in");
    expect(eventActor({}).name).toBe("Qeet ID");
  });

  it("takes a first name for “Events by …”", () => {
    expect(firstName("Mareedu Saibabu")).toBe("Mareedu");
  });
});

describe("knownTotal", () => {
  it("is the summary's total, or the bucket a severity or category filter picks", () => {
    expect(knownTotal(SUMMARY, DEFAULT_FILTERS)).toBe(197);
    expect(knownTotal(SUMMARY, { ...DEFAULT_FILTERS, severity: ["error", "critical"] })).toBe(57);
    expect(knownTotal(SUMMARY, { ...DEFAULT_FILTERS, severity: ["critical"] })).toBe(1);
    expect(knownTotal(SUMMARY, { ...DEFAULT_FILTERS, category: ["security"] })).toBe(2);
  });

  it("is unknown when the summary can't say", () => {
    expect(knownTotal(undefined, DEFAULT_FILTERS)).toBeUndefined();
    expect(
      knownTotal(SUMMARY, { ...DEFAULT_FILTERS, category: ["security"], severity: ["critical"] }),
    ).toBeUndefined();
    expect(knownTotal(SUMMARY, { ...DEFAULT_FILTERS, ip: "1.2.3.4" })).toBeUndefined();
    expect(knownTotal(SUMMARY, { ...DEFAULT_FILTERS, resource: "tenant" })).toBeUndefined();
  });
});

describe("fillSeries", () => {
  it("fills the hours the server leaves out with zeros, from the window's first bucket", () => {
    expect(fillSeries(SUMMARY, "count")).toEqual([0, 4, 0, 1]);
    expect(fillSeries(SUMMARY, "failed")).toEqual([0, 2, 0, 0]);
  });

  it("words the bucket width", () => {
    expect(bucketWords(3600)).toBe("hour");
    expect(bucketWords(1800)).toBe("30 minutes");
    expect(bucketWords(60)).toBe("minute");
    expect(bucketWords(172_800)).toBe("2 days");
  });
});

describe("time ranges", () => {
  it("resolves relative presets with an open end, 90 days included", () => {
    const { from, to } = presetToRange("90d");
    expect(Date.now() - Date.parse(from)).toBeGreaterThanOrEqual(90 * 86_400_000 - 1000);
    expect(to).toBe("");
    expect(presetToRange("all")).toEqual({ from: "", to: "" });
  });

  it("turns picked days into a window of whole local days, and back", () => {
    const window = rangeToWindow({ start: "2026-10-12", end: "2026-10-14" });
    const start = new Date(window.from);
    const end = new Date(window.to);
    expect(dayOf(start)).toBe("2026-10-12");
    expect(start.getHours()).toBe(0);
    expect(dayOf(end)).toBe("2026-10-14");
    expect(end.getHours()).toBe(23);
    expect(windowToRange(window.from, window.to)).toEqual({
      start: "2026-10-12",
      end: "2026-10-14",
    });
    expect(windowToRange("nope")).toBeUndefined();
  });
});
