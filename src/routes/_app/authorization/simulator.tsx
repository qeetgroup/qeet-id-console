import { createFileRoute } from "@tanstack/react-router";

import { PolicySimulatorPage } from "@/modules/authorization/pages";

export const Route = createFileRoute("/_app/authorization/simulator")({
  component: PolicySimulatorPage,
});
