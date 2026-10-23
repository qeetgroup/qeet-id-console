import { Button } from "@qeetrix/ui";
import { BoxIcon, BuildingComplexIcon, CrownIcon, LayersIcon, RefreshCwIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

const ACTION =
  "h-8 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";

export const PLAN_ICONS = {
  free: BoxIcon,
  starter: LayersIcon,
  pro: CrownIcon,
  enterprise: BuildingComplexIcon,
};

/** A section that failed to load, with a retry that refetches every billing read. */
export function BillingErrorState({
  label,
  fetching,
  onRetry,
}: {
  label: string;
  fetching: boolean;
  onRetry: () => unknown;
}) {
  const { t } = useTranslation("settings");
  return (
    <div
      className="flex min-h-32 flex-col items-center justify-center gap-3 px-4 py-6 text-center"
      role="alert"
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <Button
        variant="outline"
        className={ACTION}
        onClick={() => void onRetry()}
        disabled={fetching}
      >
        <RefreshCwIcon aria-hidden="true" />
        {t("billing.screen.retry")}
      </Button>
    </div>
  );
}
