import { Badge, cn } from "@qeetrix/ui";

import { useTranslation } from "react-i18next";

import { StatusPill } from "@/platform/components/status-pill";
import type { Severity } from "../types/activity.types";

type BadgeVariant = "destructive" | "warning" | "success" | "muted";

const SEVERITY_VARIANT: Record<Exclude<Severity, "info">, BadgeVariant> = {
  critical: "destructive",
  error: "destructive",
  warning: "warning",
  success: "success",
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const { t } = useTranslation("activity");
  // Info uses the blue info pill, not the default Badge's brand orange.
  if (severity === "info") {
    return (
      <StatusPill kind="info" dot={false} className={className}>
        {t("severity.info")}
      </StatusPill>
    );
  }

  return (
    <Badge
      variant={SEVERITY_VARIANT[severity]}
      className={cn(severity === "critical" && "ring-2 ring-destructive/30", className)}
    >
      {t(`severity.${severity}`)}
    </Badge>
  );
}
