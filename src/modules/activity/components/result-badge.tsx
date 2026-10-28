import { Badge, type BadgeTone } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import { type EventResult, eventResult } from "../event-labels";
import type { ActivityEvent } from "../types/activity.types";

const RESULT_TONE: Record<EventResult, BadgeTone> = {
  success: "success",
  warning: "warning",
  blocked: "warning",
  failed: "danger",
  info: "neutral", // info isn't an outcome, so it stays neutral rather than the brand colour
};

/** Renders the event's outcome (Success, Failed, Blocked…), a separate axis from severity. */
export function ResultBadge({
  event,
  className,
}: {
  event: Pick<ActivityEvent, "status" | "severity" | "type">;
  className?: string;
}) {
  const { t } = useTranslation("activity");
  const result = eventResult(event);
  return (
    <Badge tone={RESULT_TONE[result]} size="sm" className={className}>
      {t(`result.${result}`)}
    </Badge>
  );
}
