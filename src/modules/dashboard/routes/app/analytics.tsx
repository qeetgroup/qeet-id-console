import { createFileRoute } from "@tanstack/react-router";

import { AnalyticsPage } from "@/modules/dashboard/pages";

export const Route = createFileRoute("/_app/analytics")({
  staticData: { capability: "analytics.read" },
  component: AnalyticsPage,
});
