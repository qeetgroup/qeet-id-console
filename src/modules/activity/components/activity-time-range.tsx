import { Inline, Select } from "@qeetrix/react";
import { DateRangePicker } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { type DateRange, TIME_PRESETS } from "../time-range";

/** The presets a time-range control can offer, each labelled `activityTimeRange.presets.<value>`. */
export type TimeRangePreset = "all" | "15m" | "1h" | "24h" | "7d" | "30d" | "90d" | "custom";

const DEFAULT_PRESETS: readonly TimeRangePreset[] = TIME_PRESETS.map((p) => p.value);

interface ActivityTimeRangeProps {
  preset: string;
  customRange: DateRange | undefined;
  onPresetChange: (preset: string) => void;
  onCustomRangeChange: (range: DateRange | undefined) => void;
  /** The presets offered, in order. Default: TIME_PRESETS (with "all"). */
  presets?: readonly TimeRangePreset[];
  /** Placement of the whole control only. */
  className?: string;
  /** Placement of the preset select only. */
  selectClassName?: string;
  /** Placement of the date-range field only. */
  pickerClassName?: string;
}

/** The time-range preset select, and the dates of a custom range beside it once it's chosen. */
export function ActivityTimeRange({
  preset,
  customRange,
  onPresetChange,
  onCustomRangeChange,
  presets = DEFAULT_PRESETS,
  className,
  selectClassName,
  pickerClassName,
}: ActivityTimeRangeProps) {
  const { t } = useTranslation("activity");
  return (
    <Inline gap="sm" wrap={false} className={className}>
      <Select
        aria-label={t("activityTimeRange.timeRange")}
        className={selectClassName}
        value={preset as TimeRangePreset}
        onValueChange={(value) => value && onPresetChange(String(value))}
        items={presets.map((value) => ({
          value,
          label: t(`activityTimeRange.presets.${value}`),
        }))}
      />
      {preset === "custom" ? (
        <DateRangePicker
          aria-label={t("activityTimeRange.pickDates")}
          className={pickerClassName}
          value={customRange ?? null}
          onValueChange={(range) => onCustomRangeChange(range ?? undefined)}
        />
      ) : null}
    </Inline>
  );
}
