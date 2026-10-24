import { createFileRoute } from "@tanstack/react-router";

import { DeveloperOverview } from "@/modules/developer/pages";

export const Route = createFileRoute("/_app/developer/")({
  component: DeveloperOverview,
});
