import { BuildingComplexIcon } from "@qeetrix/icons";
import { cn } from "@qeetrix/ui";
import { useTranslation } from "react-i18next";

import { CreateOrgFlow } from "./create-org-flow";
import { SetupPlanArtwork } from "./setup-artwork";
import { SetupProgress } from "./setup-progress";
import { SETUP_THEME } from "./setup-styles";

import { QeetMark } from "@/shared/components/qeet-mark";

interface OrgOnboardingProps {
  title?: string;
  subtitle?: string;
  onCancel?: () => void; // shown on the plan step, e.g. to cancel an additional org
  onDone?: () => void; // after a free or enterprise create; paid plans leave for checkout
}

/** Renders the create-organization flow as a full-width page, for a first or an additional org. */
export function OrgOnboarding({ title, subtitle, onCancel, onDone }: OrgOnboardingProps) {
  const { t } = useTranslation("onboarding");
  return (
    <section
      data-slot="org-setup"
      className={cn(SETUP_THEME, "@container/setup mx-auto w-full max-w-6xl py-1")}
    >
      <CreateOrgFlow
        onCancel={onCancel}
        onDone={onDone}
        showGuidance
        renderHeader={(step) => (
          <>
            <header
              className={cn(
                "relative isolate flex flex-col gap-2.5 @max-[540px]/setup:min-h-0",
                step === "plan"
                  ? "-mt-2 gap-2"
                  : step === "name"
                    ? "-mt-2 min-h-29"
                    : "-mt-2 min-h-31",
              )}
            >
              <span
                className={cn(
                  "grid size-10 place-items-center rounded-xl border border-orange-100/70 bg-orange-100/65 dark:border-orange-500/15 dark:bg-linear-135 dark:from-orange-500/15 dark:to-(--setup-surface)",
                  step === "plan" && "size-9",
                )}
              >
                <QeetMark height={27} aria-label={t("orgOnboarding.qeetId")} />
              </span>
              <div>
                <div className="flex items-center gap-3 leading-3.5">
                  <p className="text-[10px] leading-3.5 font-semibold tracking-[0.13em] text-(--setup-accent) uppercase">
                    {t("setup.eyebrow")}
                  </p>
                  {step === "plan" && (
                    <span className="hidden items-center gap-1 rounded-full border border-(--setup-border) bg-(--setup-soft)/50 px-2 py-0.5 text-[10px] leading-3.5 dark:inline-flex">
                      <BuildingComplexIcon className="size-3" aria-hidden="true" />1 / 3
                    </span>
                  )}
                </div>
                <h1
                  className={cn(
                    "mt-1 font-sans text-[30px] font-semibold leading-[1.2] tracking-[-0.035em] @max-[540px]/setup:text-2xl",
                    step === "plan" && "text-[28px]",
                  )}
                >
                  {title ?? t("setup.title")}
                </h1>
                <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-(--setup-muted)">
                  {subtitle ?? t(step === "plan" ? "setup.planSubtitle" : "setup.detailsSubtitle")}
                </p>
              </div>
              {step === "plan" && (
                <SetupPlanArtwork className="absolute -top-3 right-0 -z-1 w-[30%] @max-[740px]/setup:hidden" />
              )}
            </header>
            <SetupProgress step={step} />
          </>
        )}
      />
    </section>
  );
}
