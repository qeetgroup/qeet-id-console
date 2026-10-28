import { createFileRoute } from "@tanstack/react-router";

import { BotsPage } from "@/modules/developer/pages";

// Rebuilt on @qeetrix/react. Off the sidebar until the server has automations; an old link says so.
export const Route = createFileRoute("/_app/developer/bots")({
  staticData: { capability: "apikey.read", pageHeader: true },
  component: BotsPage,
});
