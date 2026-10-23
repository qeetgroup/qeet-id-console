import { createFileRoute } from "@tanstack/react-router";

import { ApplicationsOverview } from "@/modules/dashboard/pages";

export const Route = createFileRoute("/_app/applications")({
  component: ApplicationsOverview,
});
