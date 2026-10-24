import { createFileRoute } from "@tanstack/react-router";

import { PolicyBuilderPage } from "@/modules/authorization/pages";

export const Route = createFileRoute("/_app/authorization/builder")({
  staticData: { capability: "policy.read" },
  component: PolicyBuilderPage,
});
