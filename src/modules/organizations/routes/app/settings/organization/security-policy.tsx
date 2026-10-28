import { createFileRoute } from "@tanstack/react-router";

import { SecurityPolicyPage } from "@/modules/organizations/pages";

export const Route = createFileRoute("/_app/settings/organization/security-policy")({
  // Rebuilt on @qeetrix/react: the page draws its own header.
  staticData: { capability: "policy.read" },
  component: SecurityPolicyPage,
});
