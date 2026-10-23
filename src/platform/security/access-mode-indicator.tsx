import { useTranslation } from "react-i18next";
import { Skeleton, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@qeetrix/ui";
import {
  BuildingComplexIcon,
  CircleAlertIcon,
  EyeIcon,
  LockKeyholeIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
} from "@qeetrix/icons";

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

export function AccessModeIndicator() {
  const { t } = useTranslation("common");
  const access = useCapabilities();

  if (access.state === "resolving") {
    return (
      <div className="flex items-center gap-2 px-2.5 py-2" role="status" aria-live="polite">
        <Skeleton className="size-3.5 shrink-0 rounded" />
        <Skeleton className="h-3 w-36 group-data-[collapsible=icon]:hidden" />
        <span className="sr-only">{t("accessModeIndicator.checkingOrganizationAccess")}</span>
      </div>
    );
  }

  const Icon = MODE_ICONS[access.mode];
  const label = t(`accessModeIndicator.mode.${access.mode}.label`);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={label}
              className="flex w-full items-center gap-2 overflow-hidden rounded-lg border border-sidebar-border/70 bg-white/3 px-2.5 py-2 text-start text-[11px] text-sidebar-foreground/65 outline-none ring-sidebar-ring focus-visible:ring-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            >
              <Icon className="size-3.5 shrink-0 text-sidebar-foreground/75" />
              <span className="truncate group-data-[collapsible=icon]:hidden">{label}</span>
            </button>
          }
        />
        <TooltipContent side="right" sideOffset={8} className="max-w-64">
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(`accessModeIndicator.mode.${access.mode}.description`)}
          </p>
          {access.state === "ready" && access.tenantId ? (
            <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
              {t("accessModeIndicator.effectiveCapabilities", { count: access.permissions.size })}
            </p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
