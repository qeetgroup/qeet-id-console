import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@qeetrix/ui";
import { CalendarClockIcon } from "@qeetrix/icons";
import { lazy, Suspense } from "react";

import { type DateRange, TIME_PRESETS } from "../time-range";

// The picker brings react-day-picker and date-fns, needed only for a custom range, so it loads
// when first shown: the activity barrel, and so this file, ships in the app's entry.
const ActivityTimeRangePicker = lazy(() =>
  import("./activity-time-range-picker").then((m) => ({ default: m.ActivityTimeRangePicker })),
);

interface ActivityTimeRangeProps {
  preset: string;
  customRange: DateRange | undefined;
  onPresetChange: (preset: string) => void;
  onCustomRangeChange: (range: DateRange | undefined) => void;
}

/** Renders the time-range preset select, plus a date-range picker for "custom". */
export function ActivityTimeRange({
  preset,
  customRange,
  onPresetChange,
  onCustomRangeChange,
}: ActivityTimeRangeProps) {
  const { t } = useTranslation("activity");
  return (
    <div className="flex items-center gap-2">
      <Select value={preset} onValueChange={(v) => v && onPresetChange(v)}>
        <SelectTrigger className="w-44 gap-2" aria-label={t("activityTimeRange.timeRange")}>
          <CalendarClockIcon
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TIME_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {t(`activityTimeRange.presets.${p.value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <Suspense fallback={null}>
          <ActivityTimeRangePicker value={customRange} onValueChange={onCustomRangeChange} />
        </Suspense>
      )}
    </div>
  );
}
