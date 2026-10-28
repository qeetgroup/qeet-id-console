import { createFileRoute } from "@tanstack/react-router";

import { webhooksSearch } from "@/modules/developer";
import { WebhooksPage } from "@/modules/developer/pages";

// Rebuilt on @qeetrix/react: the page draws its own header. Its filters live in the address, so the header's numbers link into them. The schema comes from the barrel,
// not pages: the route's options load with the shell, its component later.
export const Route = createFileRoute("/_app/developer/webhooks/")({
  staticData: { capability: "webhook.read" },
  validateSearch: webhooksSearch,
  component: function ListRoute() {
    // `action=create` opens the create drawer; the page reads it itself.
    const { action: _action, ...filters } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <WebhooksPage
        filters={filters}
        onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
      />
    );
  },
});
