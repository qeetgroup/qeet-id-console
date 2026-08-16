// ResultBadge — the event *outcome* (Success / Failed / Blocked / …), a
// separate axis from severity. Kept visually distinct so security operators
// can scan outcomes at a glance.

import { Badge, cn } from "@qeetrix/ui";

import { type EventResult, eventResult } from "../event-labels";
import type { ActivityEvent } from "../activity.types";

type BadgeVariant = "success" | "warning" | "destructive" | "muted";

const RESULT_VARIANT: Record<EventResult, BadgeVariant> = {
  Success: "success",
  Warning: "warning",
  Blocked: "warning",
  Failed: "destructive",
  // Info is a neutral, non-outcome state — a muted grey, never the brand colour.
  Info: "muted",
};

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
