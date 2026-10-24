import { createFileRoute } from "@tanstack/react-router";

import { WebhooksPage } from "@/modules/developer/pages";
import { createIntentSearch } from "@/shared/hooks/use-create-intent";

export const Route = createFileRoute("/_app/developer/webhooks/")({
  staticData: { capability: "webhook.read" },
  validateSearch: createIntentSearch,
  component: WebhooksPage,
});
