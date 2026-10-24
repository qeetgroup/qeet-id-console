// The time-range presets and their resolution, apart from the picker: the route's search schema
// reads them, and importing the picker there would put the date libraries in the shell.

import type { DateRangePickerProps } from "@qeetrix/ui";

// Lets callers hold a custom range without depending on react-day-picker.
export type DateRange = NonNullable<DateRangePickerProps["value"]>;

// Each preset's label is `activityTimeRange.presets.<value>`.
export const TIME_PRESETS = (["all", "15m", "1h", "24h", "7d", "30d", "custom"] as const).map(
  (value) => ({ value }),
);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Resolves a preset (and custom range) to an RFC 3339 window. Relative presets leave `to` open
 * so newly streamed events still match; a custom range covers whole local days. "all" or a
 * range without a start returns an empty window.
 */
export function presetToRange(preset: string, custom?: DateRange): { from: string; to: string } {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  switch (preset) {
    case "15m":
      return { from: iso(now - 15 * MINUTE), to: "" };
    case "1h":
      return { from: iso(now - HOUR), to: "" };
    case "24h":
      return { from: iso(now - DAY), to: "" };
    case "7d":
      return { from: iso(now - 7 * DAY), to: "" };
    case "30d":
      return { from: iso(now - 30 * DAY), to: "" };
    case "custom": {
      if (!custom?.from) return { from: "", to: "" };
      const start = new Date(custom.from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(custom.to ?? custom.from);
      end.setHours(23, 59, 59, 999);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    default:
      return { from: "", to: "" };
  }
}
