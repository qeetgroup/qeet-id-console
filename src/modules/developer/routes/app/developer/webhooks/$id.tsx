import { createFileRoute } from "@tanstack/react-router";

import { WebhookPage } from "@/modules/developer/pages";

// Rebuilt on @qeetrix/react: the webhook's record, drawing its own header.
export const Route = createFileRoute("/_app/developer/webhooks/$id")({
  staticData: { capability: "webhook.read" },
  component: function WebhookRoute() {
    return <WebhookPage id={Route.useParams().id} />;
  },
});
