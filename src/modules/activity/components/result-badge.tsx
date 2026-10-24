import { Badge, cn } from "@qeetrix/ui";
import { useTranslation } from "react-i18next";

import { type EventResult, eventResult } from "../event-labels";
import type { ActivityEvent } from "../types/activity.types";

type BadgeVariant = "success" | "warning" | "destructive" | "muted";

const RESULT_VARIANT: Record<EventResult, BadgeVariant> = {
  success: "success",
  warning: "warning",
  blocked: "warning",
  failed: "destructive",
  info: "muted", // info isn't an outcome, so it stays neutral grey rather than the brand colour
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
    <Badge
      variant={RESULT_VARIANT[result]}
      className={cn(result === "blocked" && "ring-1 ring-warning/40", className)}
    >
      {t(`result.${result}`)}
    </Badge>
  );
}
