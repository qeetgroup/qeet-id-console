import { createFileRoute } from "@tanstack/react-router";

import { SettingsOverview } from "@/modules/dashboard/pages";

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsOverview,
});
