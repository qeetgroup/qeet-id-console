import { createFileRoute } from "@tanstack/react-router";

import { AbacPoliciesPage } from "@/modules/authorization/pages";

export const Route = createFileRoute("/_app/authorization/abac")({
  staticData: { capability: "policy.read" },
  component: AbacPoliciesPage,
});
