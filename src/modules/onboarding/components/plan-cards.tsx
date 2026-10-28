import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { CheckIcon } from "@qeetrix/icons";
import { Badge, Skeleton, VisuallyHidden } from "@qeetrix/react";
import { useId } from "react";
import { Trans, useTranslation } from "react-i18next";

import { TIER_META, TIER_ORDER, type Tier } from "../plan-catalog";
import { formatPrice, type PlanOffer } from "../plan-pricing";

/**
 * The plans as one choice, drawn like the library's choice tiles at plan size: arrow keys move
 * between them and the group is one tab stop. Each card is a label around its radio, so the whole
 * card chooses it; the radio is named by the plan and described by its price. A plan not offered
 * in the currency and cycle can't be chosen, and says why.
 */
export function PlanCards({
  offers,
  value,
  onValueChange,
  currency,
  disabled,
}: {
  offers: readonly PlanOffer[];
  value: Tier;
  onValueChange: (tier: Tier) => void;
  currency: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation("onboarding");
  const id = useId();
  return (
    <RadioGroup
      className="create-plans"
      aria-label={t("create.plan.group")}
      value={value}
      onValueChange={(next) => onValueChange(next as Tier)}
      disabled={disabled}
    >
      {offers.map((offer) => {
        const ids = { name: `${id}-${offer.tier}`, price: `${id}-${offer.tier}-price` };
        return (
          // biome-ignore lint/a11y/noLabelWithoutControl: the radio is inside the label
          <label
            key={offer.tier}
            className="create-plan"
            data-tier={offer.tier}
            data-selected={value === offer.tier ? "" : undefined}
            data-unavailable={offer.unavailable ? "" : undefined}
          >
            <span className="create-plan-top">
              <Radio.Root
                value={offer.tier}
                disabled={offer.unavailable}
                className="create-plan-radio"
                aria-labelledby={ids.name}
                aria-describedby={ids.price}
              />
              <span id={ids.name} className="create-plan-name">
                {offer.name}
              </span>
              {TIER_META[offer.tier].popular && (
                <Badge tone="brand" variant="solid" size="sm">
                  {t("create.plan.popular")}
                </Badge>
              )}
            </span>
            <span className="create-plan-line">{offer.description}</span>
            <span id={ids.price} className="create-plan-price-block">
              <PlanPrice offer={offer} currency={currency} />
            </span>
            <ul className="create-plan-features">
              {offer.features.map((feature) => (
                <li key={feature}>
                  <CheckIcon aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
          </label>
        );
      })}
    </RadioGroup>
  );
}

function PlanPrice({ offer, currency }: { offer: PlanOffer; currency: string }) {
  const { t } = useTranslation("onboarding");
  const save = <strong />;
  const yearly = offer.yearly;
  return (
    <>
      <span className="create-plan-price">
        {offer.contactSales ? (
          <strong>{t("create.plan.custom")}</strong>
        ) : offer.price === undefined ? (
          <strong aria-hidden="true">—</strong>
        ) : (
          <>
            {yearly && (
              <s>
                <VisuallyHidden>
                  {t("create.plan.instead", { price: formatPrice(yearly.twelveMonths, currency) })}
                </VisuallyHidden>
                <span aria-hidden="true">{formatPrice(yearly.twelveMonths, currency)}</span>
              </s>
            )}
            <strong>{formatPrice(offer.price, currency)}</strong>
            {offer.price > 0 && (
              <span>
                {t(offer.planCode === offer.tier ? "create.plan.perMonth" : "create.plan.perYear")}
              </span>
            )}
          </>
        )}
      </span>
      <span className="create-plan-note">
        {offer.contactSales ? (
          t("create.plan.sales")
        ) : offer.unavailable ? (
          t("create.plan.unavailable", { currency })
        ) : offer.price === 0 ? (
          t("create.plan.free")
        ) : yearly ? (
          <Trans
            t={t}
            i18nKey="create.plan.yearly"
            values={{
              monthly: formatPrice(yearly.monthly, currency),
              saving: formatPrice(yearly.saving, currency),
              percent: yearly.percent,
            }}
            components={{ save }}
          />
        ) : offer.yearlyAlternative ? (
          <Trans
            t={t}
            i18nKey="create.plan.orYearly"
            values={{
              price: formatPrice(offer.yearlyAlternative.price, currency),
              saving: formatPrice(offer.yearlyAlternative.saving, currency),
            }}
            components={{ save }}
          />
        ) : (
          t("create.plan.monthly")
        )}
      </span>
    </>
  );
}

/** Four ruled blocks the size of the cards, while the catalogue loads. */
export function PlanCardsLoading() {
  const { t } = useTranslation("onboarding");
  return (
    <div
      className="create-plans"
      data-loading=""
      role="status"
      aria-label={t("create.plan.loading")}
    >
      {TIER_ORDER.map((tier) => (
        <Skeleton key={tier} variant="block" className="create-plan-skeleton" />
      ))}
    </div>
  );
}
