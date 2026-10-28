import { Badge, type BadgeSize, type BadgeTone } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import type { Severity } from "../types/activity.types";

// The shared severity words: Low neutral, then warning, danger, and a solid danger for the one
// that must stand out. The server's error severity reads "Failed", as its own rules intend.
const LOOK: Record<Severity, { tone: BadgeTone; solid?: boolean }> = {
  info: { tone: "neutral" },
  success: { tone: "success" },
  warning: { tone: "warning" },
  error: { tone: "danger" },
  critical: { tone: "danger", solid: true },
};

/** An event's outcome as the server rates it: Success, Info, Warning, Failed or Critical. */
export function SeverityBadge({
  severity,
  size = "sm",
  className,
}: {
  severity: Severity;
  size?: BadgeSize;
  className?: string;
}) {
  const { t } = useTranslation("activity");
  const look = LOOK[severity] ?? LOOK.info;
  return (
    <Badge
      tone={look.tone}
      variant={look.solid ? "solid" : "subtle"}
      size={size}
      className={className}
    >
      {t(`severity.${severity in LOOK ? severity : "info"}`)}
    </Badge>
  );
}
