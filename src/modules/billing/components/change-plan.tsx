import { Button, Field, Select, Text, Toggle, ToggleGroup } from "@qeetrix/react";
import { Alert } from "@qeetrix/react/experimental";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { BillingInterval, Entitlements, Plan, Subscription } from "../api/billing";
import { isCurrentOffer } from "../billing-model";
import {
  bestYearlySaving,
  currencyLabel,
  defaultCurrency,
  type PlanOffer,
  planCurrencies,
  planOffers,
  TIER_ORDER,
  type Tier,
} from "../plan-offers";
import { Panel } from "./billing-parts";
import { PlanCards, PlanCardsLoading } from "./plan-cards";

export type ChangePlanProps = {
  plans: Plan[];
  plansLoading: boolean;
  plansError: boolean;
  subscription: Subscription;
  entitlements?: Entitlements;
  current: Tier;
  initialInterval?: BillingInterval;
  initialTier?: string;
  /** Free can't be chosen until every resource count is known, to check its limits. */
  freeBlocked: boolean;
  /** The billing details are loaded, so checkout can route the payment by country. */
  checkoutReady: boolean;
  pending: string | null;
  onSwitch: (offer: PlanOffer, currency: string) => void;
  onContactSales: () => void;
  onRetry: () => void;
  onClose: () => void;
};

/**
 * Change plan, opened under the plan's row: the Create organisation plan tiles, priced for a
 * cycle and currency, with today's plan marked. One action: switch to the chosen plan (through
 * checkout for a paid one), or talk to sales for Enterprise.
 */
export function ChangePlan(props: ChangePlanProps) {
  const { t } = useTranslation("billing");
  const { t: to } = useTranslation("onboarding");
  const { plans, subscription } = props;
  const currencies = planCurrencies(plans);
  const [cycle, setCycle] = useState<BillingInterval>(
    props.initialInterval ?? (subscription.interval === "year" ? "year" : "month"),
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Tier>(
    (TIER_ORDER as readonly string[]).includes(props.initialTier ?? "")
      ? (props.initialTier as Tier)
      : props.current,
  );
  const currency =
    picked && currencies.includes(picked)
      ? picked
      : currencies.includes(subscription.currency)
        ? subscription.currency
        : defaultCurrency(currencies);
  const offers = planOffers(plans, cycle, currency);
  const saving = bestYearlySaving(plans, currency);
  const offer = offers.find((item) => item.tier === chosen);
  const onIt =
    !!offer &&
    offer.tier === props.current &&
    (offer.contactSales || isCurrentOffer(offer, subscription, currency, props.entitlements?.plan));
  const busy = !!props.pending;

  return (
    <Panel as="li" title={t("change.title")} description={t("change.description")}>
      <div className="bill-change">
        <div className="create-plan-bar">
          <ToggleGroup
            variant="segmented"
            size="lg"
            aria-label={to("create.plan.cycle")}
            value={[cycle]}
            onValueChange={(value) => value[0] && setCycle(value[0] as BillingInterval)}
            disabled={plans.length === 0 || busy}
          >
            <Toggle value="month">{to("create.plan.month")}</Toggle>
            <Toggle value="year">
              {saving > 0
                ? to("create.plan.yearSaving", { percent: saving })
                : to("create.plan.year")}
            </Toggle>
          </ToggleGroup>
          {currencies.length > 1 && (
            <Field label={t("change.currency")} className="create-currency">
              <Select
                items={currencies.map((code) => ({ value: code, label: currencyLabel(code) }))}
                value={currency}
                onValueChange={(code) => code && setPicked(String(code))}
                disabled={busy}
              />
            </Field>
          )}
        </div>
        {props.plansLoading ? (
          <PlanCardsLoading />
        ) : props.plansError ? (
          <Alert
            tone="danger"
            title={to("create.plan.errorTitle")}
            actions={
              <Button variant="ghost" onClick={props.onRetry}>
                {to("create.plan.retry")}
              </Button>
            }
          />
        ) : offers.length === 0 ? (
          <Alert tone="info" title={to("create.plan.emptyTitle")} />
        ) : (
          <PlanCards
            offers={offers}
            value={chosen}
            onValueChange={setChosen}
            currency={currency}
            current={props.current}
            disabled={busy}
          />
        )}
        {offer?.tier === "free" && props.freeBlocked && !onIt && (
          <Text size="sm" tone="subtle" className="bill-change-note">
            {t("change.freeBlocked")}
          </Text>
        )}
      </div>
      <span className="account-panel-actions">
        {!offer || onIt ? (
          <Button disabled>{t("change.on", { name: offer?.name ?? "" })}</Button>
        ) : offer.contactSales ? (
          <Button onClick={props.onContactSales} disabled={busy}>
            {t("change.talkToSales")}
          </Button>
        ) : offer.unavailable ? (
          <Button disabled>{t("change.unavailable", { currency })}</Button>
        ) : (
          <Button
            loading={props.pending === offer.planCode}
            disabled={
              (busy && props.pending !== offer.planCode) ||
              !props.checkoutReady ||
              (offer.tier === "free" && props.freeBlocked)
            }
            onClick={() => props.onSwitch(offer, currency)}
          >
            {t("change.switch", { name: offer.name })}
          </Button>
        )}
        <Button variant="ghost" onClick={props.onClose} disabled={busy}>
          {t("change.cancel")}
        </Button>
      </span>
    </Panel>
  );
}
