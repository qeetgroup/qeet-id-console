import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/modules/dashboard/pages";

// Rebuilt on @qeetrix/react: the page draws its own header.
export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
  staticData: { pageHeader: true },
});
