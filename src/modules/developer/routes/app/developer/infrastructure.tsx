import { createFileRoute } from "@tanstack/react-router";

import { InfrastructurePage } from "@/modules/developer/pages";

// Rebuilt on @qeetrix/react: the page draws its own header.
export const Route = createFileRoute("/_app/developer/infrastructure")({
  staticData: { capability: "audit.read", pageHeader: true },
  component: InfrastructurePage,
});
