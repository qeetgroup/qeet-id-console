import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircleIcon } from "@qeetrix/icons";
import { useState } from "react";

import { DashboardOverview, NoWorkspaceOnboarding } from "@/modules/dashboard";
import { OrgOnboarding } from "@/modules/onboarding/org-onboarding";
import { useCheckoutReturn } from "@/modules/onboarding/use-checkout-return";
import { useTenantId } from "@/platform/auth/session";

export const Route = createFileRoute("/_app/")({ component: DashboardPage });

/**
 * Renders the dashboard, or for a user with no organization the onboarding that runs the plan →
 * name → pay flow. A paid plan creates the organization only after payment, so the checkout
 * return is finalized here first.
 */
function DashboardPage() {
  const tenantId = useTenantId();
  const [creating, setCreating] = useState(false);
  const { finalizing } = useCheckoutReturn();

  if (finalizing) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <LoaderCircleIcon className="size-6 animate-spin" />
          <p className="text-sm">Finalizing your subscription…</p>
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
