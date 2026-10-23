import { Button, cn } from "@qeetrix/ui";
import {
  ArrowRightIcon,
  BoxIcon,
  CalendarDaysIcon,
  ChartColumnIcon,
  CheckIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  SparklesIcon,
} from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { formatMoney, type Plan, type Subscription } from "../api/billing";
import { BillingErrorState, PLAN_ICONS } from "./billing-page-parts";

const SURFACE =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 shadow-xs dark:bg-card/70 dark:shadow-none";
const ACTION =
  "h-8 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";

/** The plan the organization is on: its price, renewal, inclusions and next invoice. */
export function BillingCurrentPlan({
  id,
  subscription,
  error,
  currentPlan,
  currentTier,
  currency,
  trialing,
  trialExpired,
  fetching,
  onRetry,
  onManagePlan,
  onViewUsage,
}: {
  id: string;
  subscription?: Subscription;
  error: boolean;
  currentPlan?: Plan;
  currentTier?: string;
  currency: string;
  trialing: boolean;
  trialExpired: boolean;
  fetching: boolean;
  onRetry: () => unknown;
  onManagePlan: () => void;
  onViewUsage: () => void;
}) {
  const { t, i18n } = useTranslation("settings");
  const CurrentIcon = PLAN_ICONS[currentTier as keyof typeof PLAN_ICONS] ?? BoxIcon;
  const isFree = currentTier === "free";
  const recurring =
    !!subscription &&
    !isFree &&
    ["active", "past_due", "unpaid"].includes(subscription.status) &&
    !subscription.cancel_at_period_end;
  const currentAmount =
    subscription?.status === "none" ? currentPlan?.prices[currency] : subscription?.amount_minor;
  const currentCurrency = subscription?.status === "none" ? currency : subscription?.currency;
  const status = subscription?.cancel_at_period_end
    ? "cancelling"
    : trialExpired
      ? "trialEnded"
      : (subscription?.status ?? "unknown");

  function dateLabel(value?: string | null) {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat(i18n.language, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(date)
      : t("billing.screen.unavailable");
  }

  return (
    <section aria-labelledby={`${id}-current`} className={cn(SURFACE, "relative overflow-hidden")}>
      <div className="absolute inset-y-0 inset-s-0 w-1 bg-primary" aria-hidden="true" />
      {error || !subscription ? (
        <BillingErrorState
          label={t("billing.screen.subscriptionError")}
          fetching={fetching}
          onRetry={onRetry}
        />
      ) : (
        <div className="grid gap-5 p-4 @min-[760px]/billing:grid-cols-[1.1fr_1fr_1fr] @min-[1080px]/billing:gap-7 @min-[1080px]/billing:p-5">
          <div className="min-w-0">
            <h2 id={`${id}-current`} className="text-xs font-medium text-muted-foreground">
              {t("billing.currentPlan.title")}
            </h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-lg border border-primary/15 bg-primary/8 text-primary">
                <CurrentIcon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="font-heading text-xl font-semibold">
                {subscription.plan_name || currentPlan?.name || t("billing.screen.unavailable")}
              </h3>
              <span
                className={cn(
                  "rounded border px-2 py-0.5 text-[10px] font-medium",
                  status === "active" || status === "none"
                    ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/25 bg-amber-500/8 text-amber-800 dark:text-amber-300",
                )}
              >
                {t(`billing.screen.status.${status}`, {
                  defaultValue: t("billing.screen.status.unknown"),
                })}
              </span>
            </div>
            <p className="mt-2.5 flex flex-wrap items-baseline gap-1.5">
              <strong className="font-heading text-2xl font-semibold tabular-nums">
                {currentAmount !== undefined && currentCurrency
                  ? formatMoney(currentAmount, currentCurrency)
                  : t("billing.screen.unavailable")}
              </strong>
              <span className="text-xs text-muted-foreground">
                {t(
                  isFree
                    ? "billing.screen.forever"
                    : trialing
                      ? "billing.screen.duringTrial"
                      : subscription.interval === "year"
                        ? "billing.screen.perYear"
                        : "billing.screen.perMonth",
                )}
              </span>
            </p>
            <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-4 text-muted-foreground">
              <CalendarDaysIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {isFree
                ? t("billing.screen.noRenewal")
                : t(
                    subscription.cancel_at_period_end
                      ? "billing.screen.endsOn"
                      : trialing
                        ? "billing.screen.trialEnds"
                        : recurring
                          ? "billing.screen.renewsOn"
                          : "billing.screen.endsOn",
                    {
                      date: dateLabel(
                        trialing ? subscription.trial_end : subscription.current_period_end,
                      ),
                    },
                  )}
            </p>
          </div>
          <div className="min-w-0 border-t border-border/60 pt-4 @min-[760px]/billing:border-s @min-[760px]/billing:border-t-0 @min-[760px]/billing:ps-5 @min-[760px]/billing:pt-0">
            <p className="text-xs font-medium">{t("billing.screen.included")}</p>
            <ul className="mt-2.5 space-y-2">
              {(currentPlan?.features ?? []).slice(0, 4).map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-xs leading-4 text-muted-foreground"
                >
                  <CheckIcon
                    className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  <span>{feature}</span>
                </li>
              ))}
              {!currentPlan && (
                <li className="text-xs text-muted-foreground">
                  {t("billing.screen.featuresUnavailable")}
                </li>
              )}
            </ul>
          </div>
          <div className="flex min-w-0 flex-col justify-between gap-4 border-t border-border/60 pt-4 @min-[760px]/billing:border-s @min-[760px]/billing:border-t-0 @min-[760px]/billing:ps-5 @min-[760px]/billing:pt-0">
            <div>
              <p className="text-xs font-medium">{t("billing.screen.nextInvoice")}</p>
              <p className="mt-2 text-sm font-medium">
                {recurring
                  ? dateLabel(subscription.current_period_end)
                  : t("billing.screen.noneScheduled")}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                {t(
                  subscription.cancel_at_period_end
                    ? "billing.screen.cancellationScheduled"
                    : recurring
                      ? "billing.screen.invoiceTotalPending"
                      : "billing.screen.noRecurringCharge",
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className={cn(ACTION, "bg-primary text-primary-foreground hover:bg-primary/90")}
                onClick={onManagePlan}
              >
                {t("billing.screen.managePlan")}
                <ChevronRightIcon aria-hidden="true" />
              </Button>
              <Button variant="outline" className={ACTION} onClick={onViewUsage}>
                <ChartColumnIcon aria-hidden="true" />
                {t("billing.screen.viewUsage")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** The Pro trial offer, or the running trial's state with a way to compare plans. */
export function BillingTrialBanner({
  eligible,
  expired,
  canWrite,
  pending,
  onStart,
  onCompare,
}: {
  eligible: boolean;
  expired: boolean;
  canWrite: boolean;
  pending: string | null;
  onStart: () => void;
  onCompare: () => void;
}) {
  const { t } = useTranslation("settings");
  return (
    <aside className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <SparklesIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-xs font-medium">
            {t(
              eligible
                ? "billing.screen.trial.offer"
                : expired
                  ? "billing.screen.trial.ended"
                  : "billing.screen.trial.active",
            )}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t(eligible ? "billing.screen.trial.description" : "billing.screen.trial.convert")}
          </p>
        </div>
      </div>
      {eligible ? (
        <Button
          variant="outline"
          className={ACTION}
          disabled={!canWrite || !!pending}
          onClick={onStart}
        >
          {pending === "trial" && <LoaderCircleIcon className="animate-spin" />}
          {t("billing.screen.trial.start")}
          <ArrowRightIcon aria-hidden="true" />
        </Button>
      ) : (
        <Button variant="outline" className={ACTION} onClick={onCompare}>
          {t("billing.screen.trial.compare")}
          <ArrowRightIcon aria-hidden="true" />
        </Button>
      )}
    </aside>
  );
}
