import { Badge, cn } from "@qeetrix/ui";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";

import { humanizeMissingKey } from "@/i18n";
import { isOneOf } from "@/shared/utils/one-of";

// The server's severities and statuses are open strings; these are the ones it sends today.
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
type AnomalySeverity = (typeof SEVERITIES)[number];
const STATUSES = ["open", "resolved"] as const;
type AnomalyStatus = (typeof STATUSES)[number];

const SEVERITY_LABEL: Record<AnomalySeverity, ParseKeys<"security">> = {
  low: "threats.anomalies.severity.low",
  medium: "threats.anomalies.severity.medium",
  high: "threats.anomalies.severity.high",
  critical: "threats.anomalies.severity.critical",
};

const SEVERITY_VARIANT: Record<AnomalySeverity, "outline" | "secondary" | "destructive"> = {
  low: "outline",
  medium: "secondary",
  high: "destructive",
  critical: "destructive",
};

const STATUS_LABEL: Record<AnomalyStatus, ParseKeys<"security">> = {
  open: "threats.anomalies.status.open",
  resolved: "threats.anomalies.status.resolved",
};

/**
 * Renders an anomaly's severity, critical the strongest (ringed, as the activity log's critical
 * events are). One the console doesn't know yet reads as words, in the quietest style.
 */
export function AnomalySeverityBadge({ severity }: { severity: string }) {
  const { t } = useTranslation("security");
  if (!isOneOf(SEVERITIES, severity)) {
    return <Badge variant="outline">{humanizeMissingKey(severity)}</Badge>;
  }
  return (
    <Badge
      variant={SEVERITY_VARIANT[severity]}
      className={cn(severity === "critical" && "ring-2 ring-destructive/30")}
    >
      {t(SEVERITY_LABEL[severity])}
    </Badge>
  );
}

/** Renders an anomaly's status, open or resolved; one the console doesn't know reads as words. */
export function AnomalyStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("security");
  return (
    <Badge variant="outline">
      {isOneOf(STATUSES, status) ? t(STATUS_LABEL[status]) : humanizeMissingKey(status)}
    </Badge>
  );
}
