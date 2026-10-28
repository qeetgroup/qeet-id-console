import { createFileRoute } from "@tanstack/react-router";

import { LogStreamsPage } from "@/modules/security/pages";

// Rebuilt on @qeetrix/react: the page draws its own header.
export const Route = createFileRoute("/_app/security/log-streaming")({
  staticData: { capability: "audit.read", pageHeader: true },
  component: LogStreamsPage,
});
