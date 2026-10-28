import { describe, expect, it } from "vitest";

import { changeOf, dailyCounts, reportWindow, weekdayAverages } from "../analytics-model";

describe("the report's window", () => {
  it("covers whole UTC days up to today, and the same number before it", () => {
    const w = reportWindow("7d", "2026-10-28");
    expect(w.from).toBe("2026-10-22T00:00:00.000Z");
    expect(w.previousFrom).toBe("2026-10-15T00:00:00.000Z");
    expect(w.previousTo).toBe("2026-10-21T23:59:59.999Z");
    expect(w.dates).toEqual([
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
    ]);
    expect(w.previousDates[0]).toBe("2026-10-15");
  });

  it("stays inside the audit summary's 90-day limit", () => {
    const w = reportWindow("90d", "2026-10-28");
    const span = Date.parse(w.previousTo) - Date.parse(w.previousFrom);
    expect(span).toBeLessThan(90 * 86_400_000);
    expect(w.dates).toHaveLength(90);
  });
});

describe("the daily series", () => {
  it("fills the days the server leaves out with zero", () => {
    const dates = ["2026-10-26", "2026-10-27", "2026-10-28"];
    expect(dailyCounts([{ at: "2026-10-27T00:00:00Z", count: 4 }], dates)).toEqual([0, 4, 0]);
  });
});

describe("a change on the period before", () => {
  it("rounds to whole percent, and says when there's nothing to compare with", () => {
    expect(changeOf(120, 100)).toEqual({ kind: "up", pct: 20 });
    expect(changeOf(75, 100)).toEqual({ kind: "down", pct: 25 });
    expect(changeOf(100, 100)).toEqual({ kind: "same" });
    expect(changeOf(5, 0)).toEqual({ kind: "new" });
    expect(changeOf(0, 0)).toEqual({ kind: "none" });
  });
});

describe("the average day of the week", () => {
  it("averages the full days only, Monday first, and needs a few weeks", () => {
    const dates = reportWindow("30d", "2026-10-28").dates;
    const counts = dates.map((d) => (new Date(`${d}T00:00:00Z`).getUTCDay() === 1 ? 10 : 2));
    const averages = weekdayAverages(counts, dates);
    expect(averages?.[0]).toMatchObject({ weekday: 1, average: 10 });
    expect(averages?.[6]).toMatchObject({ weekday: 0, average: 2 });
    // Today (a Wednesday) is still counting: 29 full days.
    expect(averages?.reduce((n, a) => n + a.days, 0)).toBe(29);
    expect(
      weekdayAverages([1, 2, 3, 4, 5, 6, 7], reportWindow("7d", "2026-10-28").dates),
    ).toBeNull();
  });
});
