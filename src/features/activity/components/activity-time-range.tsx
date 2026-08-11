// Enterprise time-range control for the Activity Center.
// A preset dropdown (the primary, most-used activity filter) plus a custom
// date-range picker — the pattern used by Datadog / Auth0 / Stripe / Okta.
// Emits RFC3339 from/to strings via presetToRange(), matching the shape the
// activity filter-manager and GET /v1/activity already expect.

import {
  DateRangePicker,
  type DateRangePickerProps,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qeetrix/ui";
import { CalendarClockIcon } from "lucide-react";

// Re-exported so callers can hold the custom-range state without depending on
// react-day-picker directly.
export type DateRange = NonNullable<DateRangePickerProps["value"]>;

export const TIME_PRESETS: { value: string; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "15m", label: "Last 15 minutes" },
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom range…" },
];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Resolves a preset (+ optional custom range) to an RFC3339 { from, to } window.
 * Relative presets leave `to` open so events streaming in still pass the filter;
 * a custom range spans the full start day → end day inclusive. "all" / an
 * incomplete custom range clears the window (no time filtering).
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

interface ActivityTimeRangeProps {
  preset: string;
  customRange: DateRange | undefined;
  onPresetChange: (preset: string) => void;
  onCustomRangeChange: (range: DateRange | undefined) => void;
}

export function ActivityTimeRange({
  preset,
  customRange,
  onPresetChange,
  onCustomRangeChange,
}: ActivityTimeRangeProps) {
  return (
    <div className="flex items-center gap-2">
      <Select value={preset} onValueChange={(v) => v && onPresetChange(v)}>
        <SelectTrigger className="w-44 gap-2" aria-label="Time range">
          <CalendarClockIcon
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TIME_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <DateRangePicker
          value={customRange}
          onValueChange={onCustomRangeChange}
          placeholder="Pick dates"
          numberOfMonths={2}
        />
      )}
    </div>
  );
}
