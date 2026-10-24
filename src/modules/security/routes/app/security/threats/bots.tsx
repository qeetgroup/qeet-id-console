import { createFileRoute } from "@tanstack/react-router";

import { BotProtectionPage } from "@/modules/security/pages";

export const Route = createFileRoute("/_app/security/threats/bots")({
  staticData: { capability: "policy.read" },
  component: BotProtectionPage,
});
