import { CheckIcon, CircleCheckIcon, CreditCardIcon, HeadsetIcon } from "@qeetrix/icons";
import { Button } from "@qeetrix/react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { formatPrice, type PlanOffer } from "../plan-pricing";

/**
 * Beside the steps after the plan: the plan chosen, with a way back to change it, and what
 * happens when the form is sent — created at once, created after payment, or a talk with sales.
 */
export function PlanSummary({
  offer,
  currency,
  onChange,
  disabled,
}: {
  offer: PlanOffer;
  currency: string;
  onChange?: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("onboarding");
  const id = useId();
  const paid = !offer.contactSales && !!offer.price;
  const yearly = offer.planCode !== offer.tier;
  const price = offer.contactSales
    ? t("create.summary.custom")
    : !offer.price
      ? t("create.summary.free")
      : t(yearly ? "create.summary.perYear" : "create.summary.perMonth", {
          price: formatPrice(offer.price, currency),
        });
  const NextIcon = offer.contactSales ? HeadsetIcon : paid ? CreditCardIcon : CircleCheckIcon;

  return (
    <aside className="create-summary" aria-labelledby={`${id}-plan`}>
      <section>
        <h2 id={`${id}-plan`}>{t("create.summary.label")}</h2>
        <div className="create-summary-plan">
          <span>{offer.name}</span>
          {onChange && (
            <Button variant="ghost" size="sm" onClick={onChange} disabled={disabled}>
              {t("create.summary.change")}
            </Button>
          )}
        </div>
        <span className="create-summary-price">{price}</span>
        <ul className="create-plan-features">
          {offer.features.slice(0, 3).map((feature) => (
            <li key={feature}>
              <CheckIcon aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby={`${id}-next`}>
        <h2 id={`${id}-next`}>{t("create.summary.next")}</h2>
        <p className="create-summary-next">
          <NextIcon aria-hidden="true" />
          {t(
            offer.contactSales
              ? "create.summary.nextSales"
              : paid
                ? "create.summary.nextPaid"
                : "create.summary.nextFree",
          )}
        </p>
      </section>
    </aside>
  );
}
