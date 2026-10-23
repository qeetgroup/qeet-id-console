import { createFileRoute } from "@tanstack/react-router";

import { QeetAISettingsPage } from "@/modules/qeetai/pages";

export const Route = createFileRoute("/_app/settings/qeet-ai")({
  component: QeetAISettingsPage,
});
