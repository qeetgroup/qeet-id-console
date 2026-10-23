import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_TIMELINE_FILTERS, timelineActions, timelineStore } from "../timeline-store";

function getState() {
  return timelineStore.state;
}

function reset() {
  timelineActions.resetFilters();
  timelineActions.clearSelection();
}

beforeEach(() => {
  reset();
});

describe("setFilters", () => {
  it("applies a partial filter patch", () => {
    timelineActions.setFilters({ q: "login" });
    expect(getState().filters.q).toBe("login");
    expect(getState().filters.category).toEqual([]);
    expect(getState().filters.severity).toEqual([]);
  });

  it("appends categories without clearing existing ones when patching", () => {
    timelineActions.setFilters({ category: ["authentication"] });
    timelineActions.setFilters({ category: ["authentication", "sessions"] });
    expect(getState().filters.category).toEqual(["authentication", "sessions"]);
  });

  it("can set severity filter", () => {
    timelineActions.setFilters({ severity: ["error", "critical"] });
    expect(getState().filters.severity).toEqual(["error", "critical"]);
  });

  it("sets date range fields", () => {
    timelineActions.setFilters({ from: "2025-01-01", to: "2025-06-30" });
    expect(getState().filters.from).toBe("2025-01-01");
    expect(getState().filters.to).toBe("2025-06-30");
  });

  it("does not mutate unrelated state fields", () => {
    timelineActions.setSelectedEventId("evt-123");
    timelineActions.setFilters({ q: "password" });
    expect(getState().selectedEventId).toBe("evt-123");
  });
});

describe("resetFilters", () => {
  it("returns filters to DEFAULT_TIMELINE_FILTERS", () => {
    timelineActions.setFilters({ q: "test", category: ["security"], severity: ["error"] });
    timelineActions.resetFilters();
    expect(getState().filters).toEqual(DEFAULT_TIMELINE_FILTERS);
  });

  it("does not clear selectedEventId", () => {
    timelineActions.setSelectedEventId("evt-abc");
    timelineActions.resetFilters();
    expect(getState().selectedEventId).toBe("evt-abc");
  });
});

describe("setSelectedEventId", () => {
  it("sets the selected event ID", () => {
    timelineActions.setSelectedEventId("evt-xyz");
    expect(getState().selectedEventId).toBe("evt-xyz");
  });

  it("accepts null to clear selection", () => {
    timelineActions.setSelectedEventId("evt-xyz");
    timelineActions.setSelectedEventId(null);
    expect(getState().selectedEventId).toBeNull();
  });
});

describe("clearSelection", () => {
  it("sets selectedEventId to null", () => {
    timelineActions.setSelectedEventId("evt-42");
    timelineActions.clearSelection();
    expect(getState().selectedEventId).toBeNull();
  });

  it("does not affect filters", () => {
    timelineActions.setFilters({ q: "passkey" });
    timelineActions.clearSelection();
    expect(getState().filters.q).toBe("passkey");
  });
});

describe("DEFAULT_TIMELINE_FILTERS", () => {
  it("has empty arrays and blank strings", () => {
    expect(DEFAULT_TIMELINE_FILTERS.category).toEqual([]);
    expect(DEFAULT_TIMELINE_FILTERS.severity).toEqual([]);
    expect(DEFAULT_TIMELINE_FILTERS.q).toBe("");
    expect(DEFAULT_TIMELINE_FILTERS.from).toBe("");
    expect(DEFAULT_TIMELINE_FILTERS.to).toBe("");
  });
});
