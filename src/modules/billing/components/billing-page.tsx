import { CreditCardIcon, RefreshCwIcon } from "@qeetrix/icons";
import { Button, formatNumber, Skeleton } from "@qeetrix/react";
import { Alert, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale, humanizeMissingKey } from "@/i18n";
import { PageBreadcrumb } from "@/modules/dashboard";
import { orgQueries } from "@/modules/organizations";
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
  useBillingProfile,
  useEntitlements,
  useInvoices,
  usePlans,
  useSubscription,
  useUsage,
} from "../api/billing";
import {
  useCancelSubscription,
  useCheckout,
  useSaveBillingProfile,
  useStartTrial,
} from "../api/billing-actions";
import { billingKeys } from "../api/keys";
import { billingDay } from "../billing-format";
import {
  checkoutCountry,
  currentTier,
  hasBillingUsage,
  overFreeLimits,
  planState,
} from "../billing-model";
import { formatPrice, type PlanOffer, tierOfCode } from "../plan-offers";
import { BillingDetails } from "./billing-details";
import { BillingInvoices } from "./billing-invoices";
import { Item, Section } from "./billing-parts";
import { BillingPlan } from "./billing-plan";
import { BillingUsage } from "./billing-usage";
import { ContactSalesDialog } from "./contact-sales-dialog";
import "./billing.css";

type BillingPageSelection = {
  initialInterval?: BillingInterval;
  recommendedPlan?: string;
  checkoutResult?: "success" | "cancelled";
};

/**
 * Settings › Billing: what the organisation pays for Qeet ID and the invoices for it, in ruled
 * sections, each with its own action. The plan first (what it is and until when, with the plan
 * tiles under Change plan), then usage against the plan's caps, the billing details invoices are
 * made out to, how payment is taken, the invoices, and cancelling a paid plan.
 */
export function BillingSettingsPage(selection: BillingPageSelection) {
  const { t, i18n } = useTranslation("billing");
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
  const orgName = useQuery({ ...orgQueries.list(), enabled: !!tenantId }).data?.items.find(
    (org) => org.id === tenantId,
  )?.name;
  const checkout = useCheckout();
  const cancel = useCancelSubscription();
  const trial = useStartTrial();
  const saveProfile = useSaveBillingProfile();
  const sensitive = useSensitiveAction();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [salesOpen, setSalesOpen] = useState(false);
  const busy = useRef(false);
  const active = useRef<{ tenantId: string | null; canWrite: boolean } | null>(null);

  useEffect(() => {
    active.current = { tenantId, canWrite };
    return () => {
      active.current = null;
    };
  }, [tenantId, canWrite]);

  // An action confirmed after the organisation changed (or write access went) would act on the
  // wrong one, so it stops.
  function requireCurrentContext() {
    if (!tenantId || active.current?.tenantId !== tenantId || !active.current.canWrite) {
      throw new SensitiveActionCancelled();
    }
  }

  async function run(name: string, action: () => Promise<unknown>) {
    if (busy.current || !canWrite) return;
    busy.current = true;
    setPending(name);
    setFailure(null);
    try {
      await action();
    } catch (error) {
      if (!(error instanceof SensitiveActionCancelled)) setFailure(error);
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  const sub = canRead && !subscription.isError ? subscription.data : undefined;
  const ent = canRead && !entitlements.isError ? entitlements.data : undefined;
  const counts = canRead && !usage.isError ? usage.data?.usage : undefined;
  const tier = currentTier(sub, ent);
  const planName =
    sub?.plan_name ||
    plans.data?.items.find((plan) => plan.code === tier)?.name ||
    humanizeMissingKey(tier);
  const latestGst = invoices.data?.items.find((invoice) => invoice.tax_type.startsWith("gst_"));

  function switchPlan(offer: PlanOffer, currency: string) {
    if (!sub || offer.price === undefined || offer.contactSales) return;
    const price = offer.price;
    const current = sub.plan_name || planName;
    const toFree = offer.tier === "free";
    const over = toFree
      ? new Intl.ListFormat(i18n.language).format(
          overFreeLimits(counts).map((item) =>
            t("change.confirm.overLimit", {
              used: formatNumber(item.used, formatLocale()),
              resource: t(`usage.lower.${item.resource}`),
              limit: item.limit,
            }),
          ),
        )
      : "";
    const fromPaid =
      ["active", "ending"].includes(planState(sub)) && tierOfCode(sub.plan_code) !== "free";
    const interval = offer.planCode.endsWith("_year") ? "year" : "month";
    void run(offer.planCode, () =>
      sensitive({
        capability: "billing.write",
        actionLabel: t("change.stepUp", { name: offer.name }),
        confirm: {
          title: over
            ? t("change.confirm.freeOverTitle")
            : t("change.confirm.title", { name: offer.name }),
          description: toFree
            ? over
              ? t("change.confirm.freeOver", { resources: over, current })
              : t("change.confirm.free", { current })
            : t(fromPaid ? `change.confirm.paid.${interval}` : `change.confirm.start.${interval}`, {
                price: formatPrice(price, currency),
                name: offer.name,
                current,
              }),
          confirmLabel: t("change.switch", { name: offer.name }),
          tone: over ? "destructive" : "default",
        },
        run: () => {
          requireCurrentContext();
          return checkout.mutateAsync({
            plan_code: offer.planCode,
            currency,
            country: checkoutCountry(currency, profile.data),
          });
        },
      }),
    );
  }

  function cancelPlan() {
    if (!sub) return;
    const values = { plan: sub.plan_name, date: billingDay(sub.current_period_end) };
    void run("cancel", () =>
      sensitive({
        capability: "billing.write",
        actionLabel: t("cancel.stepUp"),
        confirm: {
          title: t("cancel.confirmTitle", values),
          description: t("cancel.confirmDescription", values),
          confirmLabel: t("cancel.confirmLabel"),
          tone: "destructive",
        },
        run: () => {
          requireCurrentContext();
          return cancel.mutateAsync();
        },
      }),
    );
  }

  async function saveDetails(input: BillingProfile) {
    const result = await sensitive({
      capability: "billing.write",
      actionLabel: t("details.stepUp"),
      run: () => {
        requireCurrentContext();
        return saveProfile.mutateAsync(input);
      },
    });
    if (!result) throw new SensitiveActionCancelled();
    queryClient.setQueryData(billingKeys.profile(tenantId), result);
    return result;
  }

  const loading =
    access.state === "resolving" || (canRead && (subscription.isPending || plans.isPending));
  const state = sub ? planState(sub) : "other";

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("page.title")}
        description={
          orgName ? t("page.description", { name: orgName }) : t("page.descriptionNoName")
        }
      />
      <PageContent className="bill-page">
        {selection.checkoutResult && (
          <Alert
            tone={selection.checkoutResult === "success" ? "success" : "info"}
            title={t(
              selection.checkoutResult === "success"
                ? "page.checkout.successTitle"
                : "page.checkout.cancelledTitle",
            )}
          >
            {t(
              selection.checkoutResult === "success"
                ? "page.checkout.success"
                : "page.checkout.cancelled",
            )}
          </Alert>
        )}
        {failure ? (
          <Alert tone="danger" title={t("page.actionFailed")} announce="urgent">
            <ErrorText error={failure} />
            <ErrorReference error={failure} />
          </Alert>
        ) : null}
        {loading ? (
          <div role="status" aria-label={t("page.loading")}>
            <Skeleton lines={8} />
          </div>
        ) : !sub ? (
          <Alert
            tone="danger"
            title={t("page.loadFailed")}
            actions={
              <Button
                variant="soft"
                size="sm"
                icon={RefreshCwIcon}
                onClick={() => void Promise.all([subscription.refetch(), plans.refetch()])}
              >
                {t("page.retry")}
              </Button>
            }
          >
            {subscription.error ? <ErrorReference error={subscription.error} /> : null}
          </Alert>
        ) : (
          <>
            <BillingPlan
              subscription={sub}
              entitlements={ent}
              plans={plans.data?.items ?? []}
              plansLoading={plans.isPending}
              plansError={plans.isError}
              current={tier}
              canWrite={canWrite}
              freeBlocked={usage.isPending || usage.isError || !hasBillingUsage(counts)}
              checkoutReady={!!profile.data && !profile.isError}
              pending={pending}
              initialInterval={selection.initialInterval}
              recommendedPlan={selection.recommendedPlan}
              onSwitch={switchPlan}
              onContactSales={() => setSalesOpen(true)}
              onStartTrial={(currency) =>
                void run("trial", () =>
                  sensitive({
                    capability: "billing.write",
                    actionLabel: t("plan.trial.stepUp"),
                    run: () => {
                      requireCurrentContext();
                      return trial.mutateAsync({ plan_code: "pro", currency });
                    },
                  }),
                )
              }
              onRetryPlans={() => void plans.refetch()}
            />
            <BillingUsage
              planName={planName}
              usage={counts}
              entitlements={ent}
              loading={usage.isPending || entitlements.isPending}
              error={usage.isError || entitlements.isError}
            />
            <BillingDetails
              profile={profile.isError ? undefined : profile.data}
              placeOfSupply={latestGst?.place_of_supply || undefined}
              canWrite={canWrite}
              loading={profile.isPending}
              error={profile.isError}
              onSave={saveDetails}
            />
            <Section title={t("payment.title")}>
              <ul className="account-rows">
                <Item icon={<CreditCardIcon />} name={t("payment.name")} line={t("payment.line")} />
              </ul>
            </Section>
            <BillingInvoices
              invoices={invoices.isError ? undefined : invoices.data?.items}
              plans={plans.data?.items ?? []}
              loading={invoices.isPending}
              error={invoices.isError}
            />
            {canWrite && state === "active" && (
              <Section
                title={t("cancel.title")}
                description={t("cancel.description", {
                  plan: sub.plan_name,
                  date: billingDay(sub.current_period_end, formatLocale()),
                })}
                action={
                  <Button
                    variant="ghost"
                    tone="danger"
                    loading={pending === "cancel"}
                    disabled={!!pending && pending !== "cancel"}
                    onClick={cancelPlan}
                  >
                    {t("cancel.action")}
                  </Button>
                }
              />
            )}
          </>
        )}
        <ContactSalesDialog open={salesOpen} onOpenChange={setSalesOpen} source="billing" />
      </PageContent>
    </>
  );
}
