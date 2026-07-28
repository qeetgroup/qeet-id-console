import { createFileRoute } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";

import {
  DashboardOverview,
  NoWorkspaceOnboarding,
} from "@/features/dashboard/components/dashboard-overview";
import { OrgOnboarding } from "@/features/onboarding/org-onboarding";
import { useCheckoutReturn } from "@/features/onboarding/use-checkout-return";
import { useTenantId } from "@/lib/auth";

export const Route = createFileRoute("/_app/")({ component: DashboardPage });

/**
 * Route boundary only; dashboard composition lives in the dashboard feature.
 * A tenant-less user (fresh signup) first sees the organization-initialization
 * overview; clicking "Create organization" starts the plan → name → pay flow.
 * A paid plan only creates the org after payment — on return we finalize and
 * switch into it.
 */
function DashboardPage() {
  const tenantId = useTenantId();
  const [creating, setCreating] = useState(false);
  const { finalizing } = useCheckoutReturn();

  if (finalizing) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2Icon className="size-6 animate-spin" />
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
