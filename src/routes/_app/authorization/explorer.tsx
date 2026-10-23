import { createFileRoute } from "@tanstack/react-router";

import { DecisionExplorerPage } from "@/modules/authorization/pages";

export const Route = createFileRoute("/_app/authorization/explorer")({
  component: DecisionExplorerPage,
});
