import { createFileRoute } from "@tanstack/react-router";

import { RiskPage } from "@/modules/security/pages";

// Rebuilt on @qeetrix/react: the page draws its own header.
export const Route = createFileRoute("/_app/security/threats/risk-settings")({
  staticData: { capability: "policy.read", pageHeader: true },
  component: RiskPage,
});
