import { createFileRoute } from "@tanstack/react-router";

import { InfrastructurePage } from "@/modules/developer/pages";

export const Route = createFileRoute("/_app/developer/infrastructure")({
  component: InfrastructurePage,
});
