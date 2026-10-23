import { createFileRoute } from "@tanstack/react-router";

import { RiskSettingsPage } from "@/modules/security/pages";

export const Route = createFileRoute("/_app/security/threats/risk-settings")({
  staticData: { capability: "policy.read" },
  component: RiskSettingsPage,
});
