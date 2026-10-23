import { createFileRoute } from "@tanstack/react-router";

import { WebhookDetailPage } from "@/modules/developer/pages";

export const Route = createFileRoute("/_app/developer/webhooks/$id")({
  component: function WebhookDetailRoute() {
    return <WebhookDetailPage id={Route.useParams().id} />;
  },
});
