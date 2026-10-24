import { DateRangePicker } from "@qeetrix/ui";
import { useTranslation } from "react-i18next";

import type { DateRange } from "../time-range";

/** Renders the two-month picker for a custom time range. */
export function ActivityTimeRangePicker({
  value,
  onValueChange,
}: {
  value: DateRange | undefined;
  onValueChange: (range: DateRange | undefined) => void;
}) {
  const { t } = useTranslation("activity");
  return (
    <DateRangePicker
      value={value}
      onValueChange={onValueChange}
      placeholder={t("activityTimeRange.pickDates")}
      numberOfMonths={2}
    />
  );
}
