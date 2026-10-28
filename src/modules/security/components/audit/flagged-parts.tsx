import { Badge, formatNumber } from "@qeetrix/react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import type { AnomalyReason } from "@/modules/security/api/audit-anomalies";

// The server counts an open flag scoring 0.85 or more as a high score (anomaly.Summary).
export const HIGH_SCORE = 0.85;
const REASONS: readonly AnomalyReason[] = ["new_action_type", "unusual_hour", "new_ip"];

/** "High 0.92", "Medium 0.70": how unusual, with the score. */
export function ScoreBadge({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
  const { t } = useTranslation("security");
  const high = score >= HIGH_SCORE;
  const value = formatNumber(score, formatLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <Badge size={size} tone={high ? "danger" : "warning"}>
      {t(high ? "audit.flagged.high" : "audit.flagged.medium", { score: value })}
    </Badge>
  );
}

/** Why it was flagged, in words: "First time · Unusual hour". */
export function reasonsText(t: TFunction<"security">, reasons: readonly string[]): string {
  return reasons
    .filter((r): r is AnomalyReason => (REASONS as readonly string[]).includes(r))
    .map((r) => t(`audit.flagged.reason.${r}`))
    .join(" · ");
}
