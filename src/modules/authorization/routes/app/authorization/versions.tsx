import { createFileRoute } from "@tanstack/react-router";

import { PolicyVersionsPage } from "@/modules/authorization/pages";

export const Route = createFileRoute("/_app/authorization/versions")({
  staticData: { capability: "policy.read" },
  component: PolicyVersionsPage,
});
