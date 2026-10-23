import { createFileRoute } from "@tanstack/react-router";

import { AnalyticsPage } from "@/modules/dashboard/pages";

export const Route = createFileRoute("/_app/analytics")({
  component: AnalyticsPage,
});
