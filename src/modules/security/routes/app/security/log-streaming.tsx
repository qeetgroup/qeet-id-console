import { createFileRoute } from "@tanstack/react-router";

import { LogStreamingPage } from "@/modules/security/pages";

export const Route = createFileRoute("/_app/security/log-streaming")({
  staticData: { capability: "audit.read" },
  component: LogStreamingPage,
});
