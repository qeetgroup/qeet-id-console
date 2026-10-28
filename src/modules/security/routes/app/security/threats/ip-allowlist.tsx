import { createFileRoute } from "@tanstack/react-router";

import { IpRulesPage } from "@/modules/security/pages";

// Rebuilt on @qeetrix/react: the page draws its own header.
export const Route = createFileRoute("/_app/security/threats/ip-allowlist")({
  staticData: { capability: "policy.read" },
  component: IpRulesPage,
});
