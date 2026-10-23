import { createFileRoute } from "@tanstack/react-router";

import { PolicyTemplatesPage } from "@/modules/authorization/pages";

export const Route = createFileRoute("/_app/authorization/templates")({
  staticData: { capability: "policy.read" },
  component: PolicyTemplatesPage,
});
