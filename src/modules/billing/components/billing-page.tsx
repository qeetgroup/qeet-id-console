import { cn, Skeleton } from "@qeetrix/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheckIcon } from "@qeetrix/icons";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useTenantId } from "@/platform/auth/session";
import { ErrorReference, ErrorText } from "@/platform/components/error-reference";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
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
import { billingKeys } from "../api/keys";
import {
  BILLING_RESOURCES,
  billingCurrencies,
  type BillingPlanChoice,
  billingPlanChoices,
  billingSavings,
  checkoutCountry,
  FREE_DOWNGRADE_LIMITS,
  hasBillingUsage,
} from "../billing-model";
import { BillingDetails } from "./billing-details";
import { BillingInvoices } from "./billing-invoices";
import { BillingCurrentPlan, BillingTrialBanner } from "./billing-page-current";
import { BillingPlans, BillingPriceControls } from "./billing-page-plans";
import { BillingUsage } from "./billing-page-usage";
import { ContactSalesDialog } from "./contact-sales-dialog";

const SURFACE =
  "min-w-0 rounded-lg border border-border/70 bg-card/90 shadow-xs dark:bg-card/70 dark:shadow-none";

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
  const { t, i18n } = useTranslation("settings");
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
            ? BILLING_RESOURCES.filter((resource) => {
                const limit = FREE_DOWNGRADE_LIMITS[resource];
                return limit !== undefined && (usage.data?.usage[resource] ?? 0) > limit;
              })
            : [];
        const downgrade = over.length > 0;
        return sensitive({
          capability: "billing.write",
          actionLabel: t("billing.stepUp.switchPlan", { name: choice.plan.name }),
          confirm: {
            title: t(
              downgrade
                ? "billing.screen.plans.downgradeTitle"
                : "billing.screen.plans.confirmTitle",
              { name: choice.plan.name },
            ),
            description: downgrade
              ? t("billing.screen.plans.downgradeDescription", {
                  resources: new Intl.ListFormat(i18n.language).format(
                    over.map((resource) =>
                      t("billing.screen.plans.overLimit", {
                        resource: t(`billing.screen.usage.${resource}`),
                        used: usage.data?.usage[resource],
                        limit: FREE_DOWNGRADE_LIMITS[resource],
                      }),
                    ),
                  ),
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
          actionLabel: t("billing.stepUp.cancelPlan"),
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
          actionLabel: t("billing.stepUp.startTrial"),
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
            actionLabel: t("billing.stepUp.saveProfile"),
            run: () => {
              requireCurrentContext();
              return saveProfile.mutateAsync(input);
            },
          });
          if (!result) throw new SensitiveActionCancelled();
          queryClient.setQueryData(billingKeys.profile(tenantId), result);
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
  const { t } = useTranslation("settings");
  const id = useId();
  const [interval, setInterval] = useState<BillingInterval | null>(props.initialInterval ?? null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [salesOpen, setSalesOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
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
  const trialing = subscription?.status === "trialing";
  const trialEligible =
    subscription?.status === "none" && plans.some((plan) => plan.code === "pro");
  const trialDate = subscription?.trial_end ? Date.parse(subscription.trial_end) : Number.NaN;
  const trialExpired = trialing && Number.isFinite(trialDate) && trialDate <= Date.now();

  async function runAction(name: string, action: () => Promise<unknown>) {
    if (busy.current || !props.canWrite) return;
    busy.current = true;
    setPending(name);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      if (!(error instanceof SensitiveActionCancelled)) setActionError(error);
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  function jumpTo(section: HTMLElement | null) {
    section?.scrollIntoView({ block: "start", behavior: "auto" });
    section?.focus({ preventScroll: true });
  }

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
          <BillingPriceControls
            interval={activeInterval}
            currency={activeCurrency}
            currencies={currencies}
            savings={savings}
            disabled={!!pending}
            onIntervalChange={setInterval}
            onCurrencyChange={setCurrency}
          />
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
          {actionError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              <ErrorText error={actionError} />
              <ErrorReference error={actionError} className="mt-1" />
            </p>
          ) : null}
          {props.checkoutResult && (
            <p
              role="status"
              className="rounded-md border border-border/70 bg-muted/40 px-4 py-3 text-xs text-muted-foreground"
            >
              {t(`billing.screen.checkout.${props.checkoutResult}`)}
            </p>
          )}
          <BillingCurrentPlan
            id={id}
            subscription={subscription}
            error={props.subscriptionError}
            currentPlan={currentPlan}
            currentTier={currentTier}
            currency={activeCurrency}
            trialing={trialing}
            trialExpired={trialExpired}
            fetching={props.fetching}
            onRetry={props.onRetry}
            onManagePlan={() => jumpTo(planSection.current)}
            onViewUsage={() => jumpTo(usageSection.current)}
          />
          {(trialEligible || trialing) && (
            <BillingTrialBanner
              eligible={trialEligible}
              expired={trialExpired}
              canWrite={props.canWrite}
              pending={pending}
              onStart={() => void runAction("trial", () => props.onStartTrial(activeCurrency))}
              onCompare={() => jumpTo(planSection.current)}
            />
          )}
          <BillingUsage
            id={id}
            ref={usageSection}
            usage={props.usage}
            entitlements={props.entitlements}
            loading={props.usageLoading}
            error={props.usageError}
            fetching={props.fetching}
            onRetry={props.onRetry}
          />
          <BillingPlans
            id={id}
            ref={planSection}
            choices={choices}
            subscription={subscription}
            currency={activeCurrency}
            entitlementPlan={props.entitlements?.plan}
            currentTier={currentTier}
            trialExpired={trialExpired}
            recommendedPlan={props.recommendedPlan}
            error={props.plansError}
            fetching={props.fetching}
            canWrite={props.canWrite}
            checkoutReady={props.checkoutReady}
            freeBlocked={props.usageError || props.usageLoading || !hasBillingUsage(props.usage)}
            pending={pending}
            onRetry={props.onRetry}
            onChoose={(choice) =>
              void runAction(choice.code, () => props.onChangePlan(choice, activeCurrency))
            }
            onContactSales={() => setSalesOpen(true)}
            onCancel={() => void runAction("cancel", props.onCancel)}
          />
          {props.children}
          <ContactSalesDialog open={salesOpen} onOpenChange={setSalesOpen} source="billing" />
        </>
      )}
    </div>
  );
}
