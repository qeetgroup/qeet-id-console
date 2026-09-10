import { ArrowRight, Box, Buildings, Crown, People } from "@qeetrix/icons";
import { cn } from "@qeetrix/ui";
import { useTranslation } from "react-i18next";

import { usePlans } from "@/modules/billing";

import type { PlanSelection } from "./plan-select";
import { SETUP_FOCUS } from "./setup-styles";

const ICONS = { free: Box, starter: People, pro: Crown, enterprise: Buildings };

export function SetupPlanSummary({
  selection,
  disabled,
  onChangePlan,
}: {
  selection: PlanSelection;
  disabled?: boolean;
  onChangePlan: () => void;
}) {
  const { t } = useTranslation("dashboard");
  const plans = usePlans();
  const plan = plans.data?.items.find((item) => item.code === selection.planCode);
  const Icon = ICONS[selection.tier];
  const name = plan?.name ?? selection.tier[0].toUpperCase() + selection.tier.slice(1);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-orange-100/60 bg-orange-50/60 px-3 py-2 dark:border-(--setup-border) dark:bg-(--setup-soft)/30">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-orange-100/70 text-(--setup-accent) dark:bg-orange-950/30">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold">{t("setup.summary.plan", { name })}</p>
        <p className="mt-0.5 text-[10px] leading-4 text-(--setup-muted)">
          {plan?.description ?? t("setup.summary.description")}
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onChangePlan}
        className={cn(
          "flex min-h-8 cursor-pointer items-center gap-1.5 rounded text-[11px] font-medium text-(--setup-accent) pointer-coarse:min-h-11",
          SETUP_FOCUS,
        )}
      >
        {t("setup.summary.change")} <ArrowRight className="size-3" aria-hidden="true" />
      </button>
    </div>
  );
}
