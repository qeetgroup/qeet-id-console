import { LoaderCircleIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { OrgOnboarding, useCheckoutReturn } from "@/modules/onboarding";
import { useTenantId } from "@/platform/auth/session";
import { DashboardOverview, NoWorkspaceOnboarding } from "./dashboard-overview";

/**
 * Renders the dashboard, or for a person with no organization the onboarding that runs the plan,
 * name and payment flow. A paid plan creates the organization only after payment, so the checkout
 * return is finalized here first.
 */
export function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const tenantId = useTenantId();
  const [creating, setCreating] = useState(false);
  const { finalizing } = useCheckoutReturn();

  if (finalizing) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <LoaderCircleIcon className="size-6 animate-spin" />
          <p className="text-sm">{t("finalizingSubscription")}</p>
        </div>
      </div>
    );
  }

  if (tenantId) return <DashboardOverview />;
  return creating ? (
    <OrgOnboarding onCancel={() => setCreating(false)} />
  ) : (
    <NoWorkspaceOnboarding onStart={() => setCreating(true)} />
  );
}
