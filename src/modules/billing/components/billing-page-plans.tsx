import {
  Button,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qeetrix/ui";
import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon, LoaderCircleIcon } from "@qeetrix/icons";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";

import { type BillingInterval, formatMoney, type Subscription } from "../api/billing";
import {
  billingCurrencyLabel,
  type BillingPlanChoice,
  isCurrentBillingChoice,
} from "../billing-model";
import { BillingErrorState, PLAN_ICONS } from "./billing-page-parts";

const SURFACE =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 shadow-xs dark:bg-card/70 dark:shadow-none";
const ACTION =
  "h-8 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";

/** The billing cycle toggle (with the annual saving) and the currency picker. */
export function BillingPriceControls({
  interval,
  currency,
  currencies,
  savings,
  disabled,
  onIntervalChange,
  onCurrencyChange,
}: {
  interval: BillingInterval;
  currency: string;
  currencies: string[];
  savings: number;
  disabled: boolean;
  onIntervalChange: (interval: BillingInterval) => void;
  onCurrencyChange: (currency: string) => void;
}) {
  const { t } = useTranslation("billing");
  return (
    <div className="flex max-w-full flex-wrap items-center gap-3">
      <fieldset
        aria-label={t("billing.screen.cycle")}
        className="inline-flex min-h-8 items-center gap-0.5 rounded-md border border-border/70 bg-muted/50 p-0.5"
      >
        {(["month", "year"] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={interval === value}
            disabled={disabled}
            onClick={() => onIntervalChange(value)}
            className={cn(
              ACTION,
              "flex cursor-pointer items-center gap-1.5 border border-transparent disabled:cursor-not-allowed",
              interval === value
                ? "border-border/70 bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`billing.screen.${value}`)}
            {value === "year" && savings > 0 && (
              <span className="rounded border border-emerald-500/20 bg-emerald-500/8 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                {t("billing.screen.savePercent", { percent: savings })}
              </span>
            )}
          </button>
        ))}
      </fieldset>
      <Select
        value={currency}
        onValueChange={(value) => value && onCurrencyChange(value)}
        disabled={disabled}
      >
        <SelectTrigger aria-label={t("billing.currency")} className={cn(ACTION, "w-29 bg-card/80")}>
          <SelectValue>{billingCurrencyLabel(currency)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {currencies.map((value) => (
            <SelectItem key={value} value={value}>
              {billingCurrencyLabel(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The plan cards for the chosen cycle and currency, and the cancel action for a paid plan. */
export function BillingPlans({
  id,
  ref,
  choices,
  subscription,
  currency,
  entitlementPlan,
  currentTier,
  trialExpired,
  recommendedPlan,
  error,
  fetching,
  canWrite,
  checkoutReady,
  freeBlocked,
  pending,
  onRetry,
  onChoose,
  onContactSales,
  onCancel,
}: {
  id: string;
  ref: Ref<HTMLElement>;
  choices: BillingPlanChoice[];
  subscription?: Subscription;
  currency: string;
  entitlementPlan?: string;
  currentTier?: string;
  trialExpired: boolean;
  recommendedPlan?: string;
  error: boolean;
  fetching: boolean;
  canWrite: boolean;
  checkoutReady?: boolean;
  // Free can't be chosen until every resource count is known, to check the downgrade limits.
  freeBlocked: boolean;
  pending: string | null;
  onRetry: () => unknown;
  onChoose: (choice: BillingPlanChoice) => void;
  onContactSales: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("billing");
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby={`${id}-plans`}
      className="min-w-0 scroll-mt-6 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-plans`} className="font-heading text-base font-semibold">
          {t("billing.screen.plans.title")}
        </h2>
        <p className="text-[11px] text-muted-foreground">{t("billing.screen.plans.taxNote")}</p>
      </div>
      {error ? (
        <BillingErrorState
          label={t("billing.screen.plans.error")}
          fetching={fetching}
          onRetry={onRetry}
        />
      ) : choices.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("billing.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-3 @min-[470px]/billing:grid-cols-2 @min-[920px]/billing:grid-cols-4">
          {choices.map((choice) => {
            const Icon = PLAN_ICONS[choice.tier as keyof typeof PLAN_ICONS];
            const current = isCurrentBillingChoice(choice, subscription, currency, entitlementPlan);
            const currentTierCard =
              currentTier === choice.tier &&
              !!subscription &&
              ["none", "active", "past_due", "unpaid", "trialing"].includes(subscription.status) &&
              !trialExpired;
            const recommended = recommendedPlan === choice.tier && !currentTierCard;
            const unavailable = !choice.contactSales && choice.amount === null;
            const annual = choice.interval === "year";
            return (
              <article
                key={choice.tier}
                data-tier={choice.tier}
                aria-labelledby={`${id}-plan-${choice.tier}`}
                className={cn(
                  SURFACE,
                  "relative flex min-w-0 flex-col p-4 transition-shadow motion-reduce:transition-none hover:shadow-sm",
                  currentTierCard
                    ? "border-primary/65 bg-linear-to-b from-primary/5 to-card ring-1 ring-primary/15 dark:from-primary/8 dark:to-card/70"
                    : recommended
                      ? "border-primary/40"
                      : "",
                )}
              >
                <div className="flex min-h-7 flex-wrap items-center justify-between gap-1.5">
                  <h3
                    id={`${id}-plan-${choice.tier}`}
                    className="flex items-center gap-2 font-heading text-base font-semibold"
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        currentTierCard ? "text-primary" : "text-muted-foreground",
                      )}
                      aria-hidden="true"
                    />
                    {choice.plan.name.replace(/\s*\(annual\)|\s*\(yearly\)/gi, "")}
                  </h3>
                  {(currentTierCard || recommended || choice.tier === "pro") && (
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[9px] font-medium",
                        currentTierCard
                          ? "border-primary/25 bg-primary/8 text-primary"
                          : "border-border/70 bg-muted/40 text-muted-foreground",
                      )}
                    >
                      {t(
                        currentTierCard
                          ? "billing.plan.current"
                          : recommended
                            ? "billing.screen.plans.recommended"
                            : "billing.plan.mostPopular",
                      )}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-1 gap-y-1">
                  <strong
                    className={cn(
                      "font-heading text-2xl leading-8 font-semibold tabular-nums",
                      currentTierCard && "text-primary",
                    )}
                  >
                    {choice.contactSales
                      ? t("billing.screen.plans.custom")
                      : choice.amount === null
                        ? t("billing.screen.unavailable")
                        : formatMoney(choice.amount, currency)}
                  </strong>
                  {!choice.contactSales && choice.amount !== null && (
                    <span className="text-[11px] text-muted-foreground">
                      {t(
                        choice.tier === "free"
                          ? "billing.screen.forever"
                          : annual
                            ? "billing.screen.perYear"
                            : "billing.screen.perMonth",
                      )}
                    </span>
                  )}
                </div>
                <p className="mt-1 min-h-9 text-[11px] leading-4.5 text-muted-foreground">
                  {choice.plan.description}
                </p>
                <div className="my-3 h-px bg-border/60" />
                <ul className="mb-5 flex-1 space-y-2">
                  {choice.plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5 text-[11px] leading-4">
                      <CheckIcon
                        className="mt-0.5 size-3 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={currentTierCard && !current ? "default" : "outline"}
                  className={cn(
                    ACTION,
                    "mt-auto w-full",
                    current && "border-primary/25 bg-primary/5 text-primary opacity-100!",
                  )}
                  disabled={
                    !!pending ||
                    (!choice.contactSales &&
                      (!canWrite ||
                        !subscription ||
                        checkoutReady === false ||
                        current ||
                        unavailable ||
                        (choice.tier === "free" && freeBlocked)))
                  }
                  onClick={() => (choice.contactSales ? onContactSales() : onChoose(choice))}
                >
                  {pending === choice.code ? (
                    <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                  ) : current ? (
                    <CheckIcon aria-hidden="true" />
                  ) : null}
                  {t(
                    choice.contactSales
                      ? "billing.screen.plans.contactSales"
                      : current
                        ? "billing.plan.isCurrent"
                        : unavailable
                          ? "billing.screen.plans.unavailable"
                          : "billing.plan.switchTo",
                    { name: choice.plan.name },
                  )}
                  {choice.contactSales ? (
                    <ArrowUpRightIcon aria-hidden="true" />
                  ) : !current && !unavailable && pending !== choice.code ? (
                    <ArrowRightIcon aria-hidden="true" />
                  ) : null}
                </Button>
              </article>
            );
          })}
        </div>
      )}
      {subscription &&
        currentTier !== "free" &&
        ["active", "trialing", "past_due", "unpaid"].includes(subscription.status) &&
        !subscription.cancel_at_period_end && (
          <div className="mt-2 flex justify-end">
            <Button
              variant="ghost"
              className={cn(ACTION, "text-muted-foreground hover:text-destructive")}
              disabled={!canWrite || !!pending}
              onClick={onCancel}
            >
              {pending === "cancel" && (
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              )}
              {t("billing.currentPlan.cancelPlan")}
            </Button>
          </div>
        )}
    </section>
  );
}
