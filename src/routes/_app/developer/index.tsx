import { createFileRoute } from "@tanstack/react-router";

import { DeveloperOverview } from "@/modules/developer/components/developer-overview";

export const Route = createFileRoute("/_app/developer/")({
  component: DeveloperOverview,
});
