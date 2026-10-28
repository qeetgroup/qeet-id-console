import { createFileRoute } from "@tanstack/react-router";

import { QeetAISettingsPage } from "@/modules/qeetai/pages";

// Rebuilt on @qeetrix/react: the page draws its own header (Settings › Qeet AI as its breadcrumb).
export const Route = createFileRoute("/_app/settings/qeet-ai")({
  staticData: { capability: "secret.read" },
  component: QeetAISettingsPage,
});
