import { useTranslation } from "react-i18next";

import { PLANS } from "@/modules/organizations/orgs-model";
import { REGIONS } from "@/shared/data/regions";

const isPlan = (plan: string): plan is (typeof PLANS)[number] =>
  (PLANS as readonly string[]).includes(plan);

/** An organisation's plan and data region in words, for the list, its filters and its page. */
export function useOrgLabels() {
  const { t, i18n } = useTranslation("organizations");
  return {
    plan: (plan: string): string =>
      isPlan(plan) ? t(`list.plans.${plan}`) : plan.charAt(0).toUpperCase() + plan.slice(1),
    region: (region: string): string => {
      const known = REGIONS.find((r) => r.value === region);
      return known ? i18n.t(known.label) : region;
    },
  };
}
