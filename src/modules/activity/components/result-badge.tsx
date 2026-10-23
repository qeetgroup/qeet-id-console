import { Badge, cn } from "@qeetrix/ui";

import { type EventResult, eventResult } from "../event-labels";
import type { ActivityEvent } from "../types/activity.types";

type BadgeVariant = "success" | "warning" | "destructive" | "muted";

const RESULT_VARIANT: Record<EventResult, BadgeVariant> = {
  Success: "success",
  Warning: "warning",
  Blocked: "warning",
  Failed: "destructive",
  Info: "muted", // Info isn't an outcome, so it stays neutral grey rather than the brand colour
};

/** Renders the event's outcome (Success, Failed, Blocked…), a separate axis from severity. */
export function ResultBadge({
  event,
  className,
}: {
  event: Pick<ActivityEvent, "status" | "severity" | "type">;
  className?: string;
}) {
  const result = eventResult(event);
  return (
    <Badge
      variant={RESULT_VARIANT[result]}
      className={cn(result === "Blocked" && "ring-1 ring-warning/40", className)}
    >
      {result}
    </Badge>
  );
}
