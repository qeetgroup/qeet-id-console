import { LayersIcon, SparklesIcon } from "@qeetrix/icons";
import { Badge, type BadgeTone, Button, formatRelativeTime } from "@qeetrix/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";

import type { BillingInterval, Entitlements, Plan, Subscription } from "../api/billing";
import { billingDay } from "../billing-format";
import { type PlanState, planState } from "../billing-model";
import { formatPrice, type PlanOffer, type Tier } from "../plan-offers";
import { Item, Section } from "./billing-parts";
import { ChangePlan } from "./change-plan";

const STATUS_TONE: Partial<Record<PlanState, BadgeTone>> = {
  active: "success",
  free: "success",
  ending: "warning",
  trial: "info",
  trialEnded: "neutral",
};
// The server's other statuses, each with its words; anything else is "Unknown status".
const OTHER_STATUSES = ["past_due", "unpaid", "canceled"] as const;

export type BillingPlanProps = {
  subscription: Subscription;
  entitlements?: Entitlements;
  plans: Plan[];
  plansLoading: boolean;
  plansError: boolean;
  current: Tier;
  canWrite: boolean;
  freeBlocked: boolean;
  checkoutReady: boolean;
  pending: string | null;
  initialInterval?: BillingInterval;
  recommendedPlan?: string;
  onSwitch: (offer: PlanOffer, currency: string) => void;
  onContactSales: () => void;
  onStartTrial: (currency: string) => void;
  onRetryPlans: () => void;
};

/**
 * What the organisation is on and until when, in one row, with Change plan opening the plan
 * tiles under it. An organisation that has never had a subscription is offered the Pro trial.
 */
export function BillingPlan(props: BillingPlanProps) {
  const { t } = useTranslation("billing");
  const { subscription } = props;
  // A plan link (an Upgrade prompt elsewhere) opens the tiles with its plan chosen.
  const [changing, setChanging] = useState(props.canWrite && !!props.recommendedPlan);
  const state = planState(subscription);
  const name =
    subscription.plan_name ||
    props.plans.find((plan) => plan.code === (props.entitlements?.plan ?? "free"))?.name ||
    props.current;
  // No badge without a subscription; Free's subscription is as active as a paid one.
  const status =
    state === "none"
      ? null
      : state === "free"
        ? "active"
        : state === "other"
          ? (OTHER_STATUSES as readonly string[]).includes(subscription.status)
            ? (subscription.status as (typeof OTHER_STATUSES)[number])
            : "unknown"
          : state;
  const trialEligible =
    props.canWrite && state === "none" && props.plans.some((plan) => plan.code === "pro");

  return (
    <Section
      title={t("plan.title")}
      status={
        status && (
          <Badge tone={STATUS_TONE[state] ?? "danger"} size="sm">
            {t(`plan.status.${status}`)}
          </Badge>
        )
      }
    >
      <ul className="account-rows">
        <Item
          icon={<LayersIcon />}
          name={name}
          line={<PlanLine subscription={subscription} state={state} current={props.current} />}
          actions={
            props.canWrite &&
            !changing && (
              <Button variant="ghost" onClick={() => setChanging(true)}>
                {t("plan.change")}
              </Button>
            )
          }
        />
        {changing && (
          <ChangePlan
            plans={props.plans}
            plansLoading={props.plansLoading}
            plansError={props.plansError}
            subscription={subscription}
            entitlements={props.entitlements}
            current={props.current}
            initialInterval={props.initialInterval}
            initialTier={props.recommendedPlan}
            freeBlocked={props.freeBlocked}
            checkoutReady={props.checkoutReady}
            pending={props.pending}
            onSwitch={props.onSwitch}
            onContactSales={props.onContactSales}
            onRetry={props.onRetryPlans}
            onClose={() => setChanging(false)}
          />
        )}
        {trialEligible && (
          <Item
            icon={<SparklesIcon />}
            name={t("plan.trial.title")}
            line={t("plan.trial.line")}
            actions={
              <Button
                variant="ghost"
                loading={props.pending === "trial"}
                disabled={!!props.pending && props.pending !== "trial"}
                onClick={() => props.onStartTrial(subscription.currency || "INR")}
              >
                {t("plan.trial.start")}
              </Button>
            }
          />
        )}
      </ul>
    </Section>
  );
}

/** The plan's one line: what it costs and until when, or why nothing is charged. */
function PlanLine({
  subscription,
  state,
  current,
}: {
  subscription: Subscription;
  state: PlanState;
  current: Tier;
}) {
  const { t } = useTranslation("billing");
  const locale = formatLocale();
  const end = subscription.current_period_end;
  const relative = (value: string | null) =>
    value ? formatRelativeTime(new Date(value), locale, Date.now()) : "";
  const money = {
    price: formatPrice(subscription.amount_minor, subscription.currency),
    per: t(subscription.interval === "year" ? "plan.per.year" : "plan.per.month"),
    tax: t(subscription.currency === "INR" ? "plan.tax.gst" : "plan.tax.other"),
    date: billingDay(end, locale),
    relative: relative(end),
  };
  switch (state) {
    case "free":
      return t("plan.line.free");
    case "active":
      return t("plan.line.paid", money);
    case "ending":
      return t("plan.line.ending", money);
    case "trial":
      return t("plan.line.trial", {
        date: billingDay(subscription.trial_end, locale),
        relative: relative(subscription.trial_end),
      });
    case "trialEnded":
      return t("plan.line.trialEnded", { date: billingDay(subscription.trial_end, locale) });
    case "none":
      return t(current === "free" ? "plan.line.free" : "plan.line.none");
    default:
      return end ? t("plan.line.other", { date: money.date }) : null;
  }
}
