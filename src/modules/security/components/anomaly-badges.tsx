import { Badge, cn } from "@qeetrix/ui";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";

import { humanizeMissingKey } from "@/i18n";
import { isOneOf } from "@/shared/utils/one-of";

import { type Anomaly, isAnomalyResolved } from "../api/anomalies";

// The server's severities are open strings; these are the ones it sends today.
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
type AnomalySeverity = (typeof SEVERITIES)[number];

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

/** Renders whether an anomaly is open or resolved; see `isAnomalyResolved`. */
export function AnomalyStatusBadge({
  anomaly,
}: {
  anomaly: Pick<Anomaly, "status" | "resolved_at">;
}) {
  const { t } = useTranslation("security");
  return (
    <Badge variant="outline">
      {isAnomalyResolved(anomaly)
        ? t("threats.anomalies.status.resolved")
        : t("threats.anomalies.status.open")}
    </Badge>
  );
}
