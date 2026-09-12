import { createFileRoute } from "@tanstack/react-router";

import { QeetAISettingsPage } from "@/modules/qeetai/components/provider-settings-page";

export const Route = createFileRoute("/_app/settings/qeet-ai")({
  component: QeetAISettingsPage,
});
