import { Badge, type BadgeTone } from "@qeetrix/react";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";

import { humanizeMissingKey } from "@/i18n";
import { isOneOf } from "@/shared/utils/one-of";

import { type Anomaly, isAnomalyResolved } from "../api/anomalies";

// The server's severities are open strings; these are the ones it sends today.
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
type AnomalySeverity = (typeof SEVERITIES)[number];

const SEVERITY_LABEL: Record<AnomalySeverity, ParseKeys<"security">> = {
  low: "anomalies.severity.low",
  medium: "anomalies.severity.medium",
  high: "anomalies.severity.high",
  critical: "anomalies.severity.critical",
};

// The console's severity words (redesign-findings §2): Low neutral, Medium warning, High danger,
// Critical solid danger, always with the word.
const SEVERITY_TONE: Record<AnomalySeverity, BadgeTone> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

/** An anomaly's severity in words; one the console doesn't know yet reads as words, neutral. */
export function AnomalySeverityBadge({ severity }: { severity: string }) {
  const { t } = useTranslation("security");
  if (!isOneOf(SEVERITIES, severity)) {
    return <Badge size="sm">{humanizeMissingKey(severity)}</Badge>;
  }
  return (
    <Badge
      size="sm"
      tone={SEVERITY_TONE[severity]}
      variant={severity === "critical" ? "solid" : "subtle"}
    >
      {t(SEVERITY_LABEL[severity])}
    </Badge>
  );
}

/** Whether an anomaly is open or resolved; see `isAnomalyResolved`. */
export function AnomalyStatusBadge({
  anomaly,
}: {
  anomaly: Pick<Anomaly, "status" | "resolved_at">;
}) {
  const { t } = useTranslation("security");
  const resolved = isAnomalyResolved(anomaly);
  return (
    <Badge size="sm" tone={resolved ? "neutral" : "warning"}>
      {resolved ? t("anomalies.status.resolved") : t("anomalies.status.open")}
    </Badge>
  );
}
