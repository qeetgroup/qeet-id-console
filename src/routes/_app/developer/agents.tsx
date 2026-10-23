import { createFileRoute } from "@tanstack/react-router";

import { AgentsPage } from "@/modules/developer/pages";

export const Route = createFileRoute("/_app/developer/agents")({
  component: AgentsPage,
});
