import { createFileRoute } from "@tanstack/react-router";

import { BotsPage } from "@/modules/developer/pages";

export const Route = createFileRoute("/_app/developer/bots")({
  staticData: { capability: "apikey.read" },
  component: BotsPage,
});
