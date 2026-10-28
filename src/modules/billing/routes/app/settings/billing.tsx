import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { BillingSettingsPage } from "@/modules/billing/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// A plan link opens Change plan on the plan and cycle; the payment provider returns with
// `checkout`. Rebuilt on @qeetrix/react: the page draws its own header.
const billingSearch = z.object({
  plan: searchText(),
  interval: searchEnum(["month", "year"]),
  checkout: searchEnum(["success", "cancelled"]),
});

export const Route = createFileRoute("/_app/settings/billing")({
  staticData: { capability: "billing.read", pageHeader: true },
  component: BillingPage,
  validateSearch: billingSearch,
});

function BillingPage() {
  const search = Route.useSearch();
  return (
    <BillingSettingsPage
      initialInterval={search.interval}
      recommendedPlan={search.plan}
      checkoutResult={search.checkout}
    />
  );
}
