import { Badge, cn, StatusPill } from "@qeetrix/ui";

import type { Severity } from "../types/activity.types";

type BadgeVariant = "destructive" | "warning" | "success" | "muted";

const SEVERITY_VARIANT: Record<Exclude<Severity, "info">, BadgeVariant> = {
  critical: "destructive",
  error: "destructive",
  warning: "warning",
  success: "success",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  error: "Error",
  warning: "Warning",
  success: "Success",
  info: "Info",
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  // Info uses the blue info pill, not the default Badge's brand orange.
  if (severity === "info") {
    return (
      <StatusPill kind="info" dot={false} className={className}>
        {SEVERITY_LABEL.info}
      </StatusPill>
    );
  }

  return (
    <Badge
      variant={SEVERITY_VARIANT[severity]}
      className={cn(severity === "critical" && "ring-2 ring-destructive/30", className)}
    >
      {SEVERITY_LABEL[severity]}
    </Badge>
  );
}
