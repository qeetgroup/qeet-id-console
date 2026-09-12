import { createFileRoute } from "@tanstack/react-router";

import { BillingSettingsPage } from "@/modules/billing/components/billing-page";

type BillingSearch = {
  plan?: string;
  interval?: "month" | "year";
  checkout?: "success" | "cancelled";
};

export const Route = createFileRoute("/_app/settings/billing")({
  component: BillingPage,
  validateSearch: (raw: Record<string, unknown>): BillingSearch => ({
    plan: typeof raw.plan === "string" ? raw.plan : undefined,
    interval: raw.interval === "year" ? "year" : raw.interval === "month" ? "month" : undefined,
    checkout:
      raw.checkout === "success"
        ? "success"
        : raw.checkout === "cancelled"
          ? "cancelled"
          : undefined,
  }),
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
