import {
  Button,
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@qeetrix/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLineIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BarChart3Icon,
  BoxIcon,
  Building2Icon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronRightIcon,
  CrownIcon,
  KeyRoundIcon,
  LayersIcon,
  Loader2Icon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useTenantId } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { exportToCsv } from "@/shared/utils/data-export";
import {
  type BillingInterval,
  type BillingProfile,
  type Entitlements,
  formatMoney,
  type Plan,
  type Subscription,
  useBillingProfile,
  useCancelSubscription,
  useCheckout,
  useEntitlements,
  useInvoices,
  usePlans,
  useSaveBillingProfile,
  useStartTrial,
  useSubscription,
  useUsage,
} from "../api/billing";
import {
  BILLING_RESOURCES,
  billingCurrencies,
  billingCurrencyLabel,
  type BillingPlanChoice,
  billingPlanChoices,
  billingSavings,
  billingUsage,
  checkoutCountry,
  FREE_DOWNGRADE_LIMITS,
  hasBillingUsage,
  isCurrentBillingChoice,
} from "../billing-model";
import { BillingDetails } from "./billing-details";
import { BillingInvoices } from "./billing-invoices";
import { ContactSalesDialog } from "./contact-sales-dialog";

const SURFACE =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 shadow-xs dark:bg-card/70 dark:shadow-none";
const ACTION =
  "h-8 rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11";
const PLAN_ICONS = {
  free: BoxIcon,
  starter: LayersIcon,
  pro: CrownIcon,
  enterprise: Building2Icon,
};
const RESOURCE_ICONS = {
  seats: UsersIcon,
  apps: LayersIcon,
  api_keys: KeyRoundIcon,
  custom_roles: ShieldCheckIcon,
};

export type BillingSettingsViewProps = {
  plans: Plan[];
  subscription?: Subscription;
  entitlements?: Entitlements;
  usage?: Record<string, number>;
  profile?: BillingProfile;
  loading: boolean;
  subscriptionError: boolean;
  plansError: boolean;
  usageLoading: boolean;
  usageError: boolean;
  canRead: boolean;
  canWrite: boolean;
  checkoutReady?: boolean;
  fetching: boolean;
  initialInterval?: BillingInterval;
  recommendedPlan?: string;
  checkoutResult?: "success" | "cancelled";
  onRetry: () => unknown;
  onChangePlan: (choice: BillingPlanChoice, currency: string) => Promise<unknown>;
  onCancel: () => Promise<unknown>;
  onStartTrial: (currency: string) => Promise<unknown>;
  children?: ReactNode;
};

type BillingPageSelection = Pick<
  BillingSettingsViewProps,
  "initialInterval" | "recommendedPlan" | "checkoutResult"
>;

export function BillingSettingsPage(selection: BillingPageSelection) {
  const { t } = useTranslation("settings");
  const tenantId = useTenantId();
  const access = useCapabilities();
  const canRead = !!tenantId && access.state === "ready" && access.can("billing.read");
  const canWrite = canRead && access.can("billing.write");
  const plans = usePlans();
  const subscription = useSubscription(canRead);
  const entitlements = useEntitlements(canRead);
  const usage = useUsage(canRead);
  const profile = useBillingProfile(canRead);
  const invoices = useInvoices(canRead);
  const checkout = useCheckout();
  const cancel = useCancelSubscription();
  const trial = useStartTrial();
  const saveProfile = useSaveBillingProfile();
  const sensitive = useSensitiveAction();
  const queryClient = useQueryClient();
  const activeContext = useRef<{ tenantId: string | null; canWrite: boolean } | null>(null);

  useEffect(() => {
    activeContext.current = { tenantId, canWrite };
    return () => {
      activeContext.current = null;
    };
  }, [tenantId, canWrite]);

  function requireCurrentContext() {
    if (
      !tenantId ||
      activeContext.current?.tenantId !== tenantId ||
      !activeContext.current.canWrite
    ) {
      throw new SensitiveActionCancelled();
    }
  }

  return (
    <BillingSettingsView
      key={`${tenantId}:${canWrite}`}
      {...selection}
      plans={plans.data?.items ?? []}
      subscription={canRead && !subscription.isError ? subscription.data : undefined}
      entitlements={canRead && !entitlements.isError ? entitlements.data : undefined}
      usage={canRead && !usage.isError ? usage.data?.usage : undefined}
      loading={
        access.state === "resolving" || (canRead && (subscription.isPending || plans.isPending))
      }
      subscriptionError={subscription.isError}
      plansError={plans.isError}
      usageLoading={usage.isPending || entitlements.isPending}
      usageError={usage.isError || entitlements.isError}
      canRead={canRead}
      canWrite={canWrite}
      checkoutReady={!!profile.data && !profile.isError}
      fetching={
        plans.isFetching || subscription.isFetching || usage.isFetching || entitlements.isFetching
      }
      onRetry={() =>
        Promise.all([
          plans.refetch(),
          subscription.refetch(),
          usage.refetch(),
          entitlements.refetch(),
        ])
      }
      onChangePlan={async (choice, currency) => {
        if (
          choice.amount === null ||
          choice.contactSales ||
          !profile.data ||
          profile.isError ||
          (choice.tier === "free" && (usage.isError || !hasBillingUsage(usage.data?.usage)))
        )
          throw new SensitiveActionCancelled();
        const over =
          choice.tier === "free"
            ? BILLING_RESOURCES.filter(
                (resource) => (usage.data?.usage[resource] ?? 0) > FREE_DOWNGRADE_LIMITS[resource],
              )
            : [];
        const downgrade = over.length > 0;
        return sensitive({
          capability: "billing.write",
          actionLabel: t("billing.plan.switchTo", { name: choice.plan.name }),
          confirm: {
            title: t(
              downgrade
                ? "billing.screen.plans.downgradeTitle"
                : "billing.screen.plans.confirmTitle",
              { name: choice.plan.name },
            ),
            description: downgrade
              ? t("billing.screen.plans.downgradeDescription", {
                  resources: over
                    .map(
                      (resource) =>
                        `${t(`billing.screen.usage.${resource}`)} (${usage.data?.usage[resource]}/${FREE_DOWNGRADE_LIMITS[resource]})`,
                    )
                    .join(", "),
                })
              : t("billing.screen.plans.confirmDescription", {
                  amount: formatMoney(choice.amount, currency),
                  period: t(
                    choice.tier === "free"
                      ? "billing.screen.forever"
                      : choice.interval === "year"
                        ? "billing.screen.perYear"
                        : "billing.screen.perMonth",
                  ),
                }),
            confirmLabel: t(
              downgrade ? "billing.screen.plans.downgradeConfirm" : "billing.plan.switchTo",
              { name: choice.plan.name },
            ),
            tone: downgrade ? "destructive" : "default",
          },
          run: () => {
            requireCurrentContext();
            return checkout.mutateAsync({
              plan_code: choice.code,
              currency,
              country: checkoutCountry(currency, profile.data),
            });
          },
        });
      }}
      onCancel={() =>
        sensitive({
          capability: "billing.write",
          actionLabel: t("billing.currentPlan.cancelPlan"),
          confirm: {
            title: t("billing.currentPlan.cancelConfirmTitle"),
            description: t("billing.currentPlan.cancelConfirmDescription"),
            confirmLabel: t("billing.currentPlan.cancelConfirmLabel"),
            tone: "destructive",
          },
          run: () => {
            requireCurrentContext();
            return cancel.mutateAsync();
          },
        })
      }
      onStartTrial={(currency) =>
        sensitive({
          capability: "billing.write",
          actionLabel: t("billing.screen.trial.start"),
          run: () => {
            requireCurrentContext();
            return trial.mutateAsync({ plan_code: "pro", currency });
          },
        })
      }
    >
      <BillingDetails
        profile={canRead && !profile.isError ? profile.data : undefined}
        canWrite={canWrite}
        loading={profile.isPending}
        error={profile.isError}
        fetching={profile.isFetching}
        onRetry={profile.refetch}
        onSave={async (input) => {
          const result = await sensitive({
            capability: "billing.write",
            actionLabel: t("billing.screen.profile.save"),
            run: () => {
              requireCurrentContext();
              return saveProfile.mutateAsync(input);
            },
          });
          if (!result) throw new SensitiveActionCancelled();
          queryClient.setQueryData(["billing", "profile", tenantId], result);
          return result;
        }}
      />
      <BillingInvoices
        invoices={canRead && !invoices.isError ? invoices.data?.items : undefined}
        plans={plans.isError ? [] : (plans.data?.items ?? [])}
        loading={invoices.isPending}
        error={invoices.isError}
        fetching={invoices.isFetching}
        onRetry={invoices.refetch}
      />
    </BillingSettingsView>
  );
}

export function BillingSettingsView(props: BillingSettingsViewProps) {
  const { t, i18n } = useTranslation("settings");
  const id = useId();
  const [interval, setInterval] = useState<BillingInterval | null>(props.initialInterval ?? null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [salesOpen, setSalesOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = useRef(false);
  const planSection = useRef<HTMLElement>(null);
  const usageSection = useRef<HTMLElement>(null);
  const subscription = props.canRead && !props.subscriptionError ? props.subscription : undefined;
  const plans = props.plansError ? [] : props.plans;
  const currencies = billingCurrencies(plans);
  const activeInterval = interval ?? (subscription?.interval === "year" ? "year" : "month");
  const activeCurrency =
    [currency, subscription?.currency, "INR", "USD", currencies[0]].find(
      (value): value is string => !!value && currencies.includes(value),
    ) ?? "USD";
  const savings = billingSavings(plans, activeCurrency);
  const choices = billingPlanChoices(plans, activeInterval, activeCurrency);
  const currentCode =
    subscription?.status === "none" ? props.entitlements?.plan || "free" : subscription?.plan_code;
  const currentPlan = plans.find((plan) => plan.code === currentCode);
  const currentTier = currentCode?.replace(/_year$/, "");
  const CurrentIcon = PLAN_ICONS[currentTier as keyof typeof PLAN_ICONS] ?? BoxIcon;
  const isFree = currentTier === "free";
  const trialing = subscription?.status === "trialing";
  const trialEligible =
    subscription?.status === "none" && plans.some((plan) => plan.code === "pro");
  const trialDate = subscription?.trial_end ? Date.parse(subscription.trial_end) : Number.NaN;
  const trialExpired = trialing && Number.isFinite(trialDate) && trialDate <= Date.now();
  const recurring =
    !!subscription &&
    !isFree &&
    ["active", "past_due", "unpaid"].includes(subscription.status) &&
    !subscription.cancel_at_period_end;
  const currentAmount =
    subscription?.status === "none"
      ? currentPlan?.prices[activeCurrency]
      : subscription?.amount_minor;
  const currentCurrency = subscription?.status === "none" ? activeCurrency : subscription?.currency;
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

  async function runAction(name: string, action: () => Promise<unknown>) {
    if (busy.current || !props.canWrite) return;
    busy.current = true;
    setPending(name);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      if (!(error instanceof SensitiveActionCancelled)) setActionError(errorMessage(error));
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  function jumpTo(section: HTMLElement | null) {
    section?.scrollIntoView({ block: "start", behavior: "auto" });
    section?.focus({ preventScroll: true });
  }

  const errorState = (label: string) => (
    <div
      className="flex min-h-32 flex-col items-center justify-center gap-3 px-4 py-6 text-center"
      role="alert"
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <Button
        variant="outline"
        className={ACTION}
        onClick={() => void props.onRetry()}
        disabled={props.fetching}
      >
        <RefreshCwIcon aria-hidden="true" />
        {t("billing.screen.retry")}
      </Button>
    </div>
  );

  return (
    <div className="@container/billing relative isolate flex min-w-0 flex-col gap-5 before:pointer-events-none before:absolute before:-inset-4 before:-z-10 before:bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] before:bg-size-[32px_32px] before:opacity-10 dark:before:opacity-5">
      <header className="flex flex-wrap items-center justify-between gap-4 py-1">
        <div className="min-w-0">
          <h1 className="font-heading text-[30px] leading-9 font-semibold">
            {t("billing.screen.title")}
          </h1>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{t("billing.description")}</p>
        </div>
        {props.canRead && !props.plansError && currencies.length > 0 && (
          <div className="flex max-w-full flex-wrap items-center gap-3">
            <fieldset
              aria-label={t("billing.screen.cycle")}
              className="inline-flex min-h-8 items-center gap-0.5 rounded-md border border-border/70 bg-muted/50 p-0.5"
            >
              {(["month", "year"] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={activeInterval === value}
                  disabled={!!pending}
                  onClick={() => setInterval(value)}
                  className={cn(
                    ACTION,
                    "flex cursor-pointer items-center gap-1.5 border border-transparent disabled:cursor-not-allowed",
                    activeInterval === value
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
              value={activeCurrency}
              onValueChange={(value) => value && setCurrency(value)}
              disabled={!!pending}
            >
              <SelectTrigger
                aria-label={t("billing.currency")}
                className={cn(ACTION, "w-29 bg-card/80")}
              >
                <SelectValue>{billingCurrencyLabel(activeCurrency)}</SelectValue>
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
        )}
      </header>

      {props.loading ? (
        <div role="status" aria-label={t("billing.screen.loading")} className="space-y-5">
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {["free", "starter", "pro", "enterprise"].map((tier) => (
              <Skeleton key={tier} className="h-80 rounded-lg" />
            ))}
          </div>
        </div>
      ) : !props.canRead ? (
        <section
          className={cn(
            SURFACE,
            "grid min-h-72 place-content-center justify-items-center gap-3 p-6 text-center",
          )}
        >
          <ShieldCheckIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-heading text-base font-semibold">{t("billing.screen.noAccess")}</h2>
        </section>
      ) : (
        <>
          {actionError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {actionError}
            </p>
          )}
          {props.checkoutResult && (
            <p
              role="status"
              className="rounded-md border border-border/70 bg-muted/40 px-4 py-3 text-xs text-muted-foreground"
            >
              {t(`billing.screen.checkout.${props.checkoutResult}`)}
            </p>
          )}
          <section
            aria-labelledby={`${id}-current`}
            className={cn(SURFACE, "relative overflow-hidden")}
          >
            <div className="absolute inset-y-0 inset-s-0 w-1 bg-primary" aria-hidden="true" />
            {props.subscriptionError || !subscription ? (
              errorState(t("billing.screen.subscriptionError"))
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
                      {subscription.plan_name ||
                        currentPlan?.name ||
                        t("billing.screen.unavailable")}
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
                      className={cn(
                        ACTION,
                        "bg-primary text-primary-foreground hover:bg-primary/90",
                      )}
                      onClick={() => jumpTo(planSection.current)}
                    >
                      {t("billing.screen.managePlan")}
                      <ChevronRightIcon aria-hidden="true" />
                    </Button>
                    <Button
                      variant="outline"
                      className={ACTION}
                      onClick={() => jumpTo(usageSection.current)}
                    >
                      <BarChart3Icon aria-hidden="true" />
                      {t("billing.screen.viewUsage")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {(trialEligible || trialing) && (
            <aside className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <SparklesIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-xs font-medium">
                    {t(
                      trialEligible
                        ? "billing.screen.trial.offer"
                        : trialExpired
                          ? "billing.screen.trial.ended"
                          : "billing.screen.trial.active",
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t(
                      trialEligible
                        ? "billing.screen.trial.description"
                        : "billing.screen.trial.convert",
                    )}
                  </p>
                </div>
              </div>
              {trialEligible ? (
                <Button
                  variant="outline"
                  className={ACTION}
                  disabled={!props.canWrite || !!pending}
                  onClick={() => void runAction("trial", () => props.onStartTrial(activeCurrency))}
                >
                  {pending === "trial" && <Loader2Icon className="animate-spin" />}
                  {t("billing.screen.trial.start")}
                  <ArrowRightIcon aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className={ACTION}
                  onClick={() => jumpTo(planSection.current)}
                >
                  {t("billing.screen.trial.compare")}
                  <ArrowRightIcon aria-hidden="true" />
                </Button>
              )}
            </aside>
          )}

          <section
            ref={usageSection}
            tabIndex={-1}
            aria-labelledby={`${id}-usage`}
            className="min-w-0 scroll-mt-6 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id={`${id}-usage`} className="font-heading text-base font-semibold">
                {t("billing.screen.usage.title")}
              </h2>
              <Button
                variant="ghost"
                className={cn(ACTION, "h-7 text-muted-foreground")}
                disabled={
                  props.usageLoading || props.usageError || !props.usage || !props.entitlements
                }
                onClick={() =>
                  exportToCsv(
                    "billing-usage",
                    BILLING_RESOURCES.map((resource) => ({
                      resource,
                      used: props.usage?.[resource],
                      limit: props.entitlements?.limits[resource],
                    })),
                    [
                      { header: "Resource", value: (row) => row.resource },
                      { header: "Used", value: (row) => row.used },
                      { header: "Limit (-1 = unlimited)", value: (row) => row.limit },
                    ],
                  )
                }
              >
                <ArrowDownToLineIcon aria-hidden="true" />
                {t("billing.screen.usage.export")}
              </Button>
            </div>
            <div
              className={cn(
                SURFACE,
                "grid divide-y divide-border/60 @min-[480px]/billing:grid-cols-2 @min-[880px]/billing:grid-cols-4 @min-[880px]/billing:divide-x @min-[880px]/billing:divide-y-0",
              )}
            >
              {BILLING_RESOURCES.map((resource) => {
                const meter = billingUsage(
                  props.usageError ? undefined : props.usage?.[resource],
                  props.usageError ? undefined : props.entitlements?.limits[resource],
                );
                const Icon = RESOURCE_ICONS[resource];
                const label = t(`billing.screen.usage.${resource}`);
                return (
                  <article key={resource} className="min-w-0 px-4 py-3.5">
                    <h3 className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                      {label}
                    </h3>
                    {props.usageLoading ? (
                      <Skeleton className="my-2 h-8 w-2/3" />
                    ) : (
                      <p className="my-2 flex flex-wrap items-baseline gap-1.5">
                        <strong
                          className={cn(
                            "font-heading text-xl font-semibold tabular-nums",
                            meter.exceeded && "text-destructive",
                          )}
                        >
                          {meter.used === null
                            ? t("billing.screen.unavailable")
                            : meter.used.toLocaleString(i18n.language)}
                        </strong>
                        <span className="text-[11px] text-muted-foreground">
                          {meter.unlimited
                            ? t("billing.screen.usage.unlimited")
                            : meter.limit !== null
                              ? `/ ${meter.limit.toLocaleString(i18n.language)}`
                              : ""}
                        </span>
                      </p>
                    )}
                    <div
                      role="progressbar"
                      aria-hidden={meter.percent === null}
                      aria-label={label}
                      aria-valuemin={meter.percent !== null ? 0 : undefined}
                      aria-valuemax={meter.percent !== null ? 100 : undefined}
                      aria-valuenow={meter.percent ?? undefined}
                      aria-valuetext={
                        meter.percent !== null
                          ? t("billing.screen.usage.count", {
                              used: meter.used,
                              limit: meter.limit,
                            })
                          : undefined
                      }
                      className="h-1 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className={cn(
                          "h-full rounded-full",
                          meter.exceeded ? "bg-destructive" : "bg-primary",
                        )}
                        style={{ width: `${meter.percent ?? 0}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {props.usageLoading
                        ? t("billing.screen.usage.loading")
                        : meter.used === null || meter.limit === null
                          ? t("billing.screen.usage.unavailable")
                          : meter.exceeded
                            ? t("billing.screen.usage.exceeded")
                            : meter.unlimited
                              ? t("billing.screen.usage.noCap")
                              : meter.limit === 0
                                ? t("billing.screen.usage.notIncluded")
                                : t("billing.screen.usage.percent", { percent: meter.percent })}
                    </p>
                  </article>
                );
              })}
            </div>
            {props.usageError && (
              <div className="mt-2 text-xs">{errorState(t("billing.screen.usage.error"))}</div>
            )}
          </section>

          <section
            ref={planSection}
            tabIndex={-1}
            aria-labelledby={`${id}-plans`}
            className="min-w-0 scroll-mt-6 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id={`${id}-plans`} className="font-heading text-base font-semibold">
                {t("billing.screen.plans.title")}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {t("billing.screen.plans.taxNote")}
              </p>
            </div>
            {props.plansError ? (
              errorState(t("billing.screen.plans.error"))
            ) : choices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("billing.empty")}</p>
            ) : (
              <div className="grid grid-cols-1 items-stretch gap-3 @min-[470px]/billing:grid-cols-2 @min-[920px]/billing:grid-cols-4">
                {choices.map((choice) => {
                  const Icon = PLAN_ICONS[choice.tier as keyof typeof PLAN_ICONS];
                  const current = isCurrentBillingChoice(
                    choice,
                    subscription,
                    activeCurrency,
                    props.entitlements?.plan,
                  );
                  const currentTierCard =
                    currentTier === choice.tier &&
                    !!subscription &&
                    ["none", "active", "past_due", "unpaid", "trialing"].includes(
                      subscription.status,
                    ) &&
                    !trialExpired;
                  const recommended = props.recommendedPlan === choice.tier && !currentTierCard;
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
                              : formatMoney(choice.amount, activeCurrency)}
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
                          <li
                            key={feature}
                            className="flex items-start gap-1.5 text-[11px] leading-4"
                          >
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
                            (!props.canWrite ||
                              !subscription ||
                              props.checkoutReady === false ||
                              current ||
                              unavailable ||
                              (choice.tier === "free" &&
                                (props.usageError ||
                                  props.usageLoading ||
                                  !hasBillingUsage(props.usage)))))
                        }
                        onClick={() =>
                          choice.contactSales
                            ? setSalesOpen(true)
                            : void runAction(choice.code, () =>
                                props.onChangePlan(choice, activeCurrency),
                              )
                        }
                      >
                        {pending === choice.code ? (
                          <Loader2Icon className="animate-spin" aria-hidden="true" />
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
              !isFree &&
              ["active", "trialing", "past_due", "unpaid"].includes(subscription.status) &&
              !subscription.cancel_at_period_end && (
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    className={cn(ACTION, "text-muted-foreground hover:text-destructive")}
                    disabled={!props.canWrite || !!pending}
                    onClick={() => void runAction("cancel", props.onCancel)}
                  >
                    {pending === "cancel" && (
                      <Loader2Icon className="animate-spin" aria-hidden="true" />
                    )}
                    {t("billing.currentPlan.cancelPlan")}
                  </Button>
                </div>
              )}
          </section>
          {props.children}
          <ContactSalesDialog open={salesOpen} onOpenChange={setSalesOpen} source="billing" />
        </>
      )}
    </div>
  );
}
