import {
  BuildingComplexIcon,
  CircleAlertIcon,
  EyeIcon,
  LockKeyholeIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
} from "@qeetrix/icons";
import { Skeleton, Tooltip, VisuallyHidden } from "@qeetrix/react";
import { useAppShell } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { useCapabilities } from "./capability-provider";

// Each mode's copy is `accessModeIndicator.mode.<mode>`.
const MODE_ICONS = {
  setup: BuildingComplexIcon,
  full: ShieldCheckIcon,
  "read-only": EyeIcon,
  restricted: SlidersHorizontalIcon,
  none: LockKeyholeIcon,
  unknown: CircleAlertIcon,
} as const;

/**
 * The person's access in this organisation, at the foot of the navigation: "Full console access",
 * "Read-only console access"… with what it means on hover or focus. The rail shows only its icon.
 */
export function AccessModeIndicator() {
  const { t } = useTranslation("common");
  const access = useCapabilities();
  const { collapsed } = useAppShell();

  if (access.state === "resolving") {
    return (
      <div className="console-access" role="status" aria-live="polite">
        <Skeleton style={{ inlineSize: collapsed ? "1rem" : "9rem" }} />
        <VisuallyHidden>{t("accessModeIndicator.checkingOrganizationAccess")}</VisuallyHidden>
      </div>
    );
  }

  const Icon = MODE_ICONS[access.mode];
  const label = t(`accessModeIndicator.mode.${access.mode}.label`);
  const description = t(`accessModeIndicator.mode.${access.mode}.description`);
  const count =
    access.state === "ready" && access.tenantId
      ? t("accessModeIndicator.effectiveCapabilities", { count: access.permissions.size })
      : null;

  return (
    <Tooltip content={count ? `${description} ${count}.` : description} side="right">
      <button type="button" className="console-access" aria-label={label}>
        <Icon size={16} aria-hidden="true" />
        {!collapsed && <span>{label}</span>}
      </button>
    </Tooltip>
  );
}
