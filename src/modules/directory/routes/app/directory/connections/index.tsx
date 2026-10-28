import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ConnectionsPage } from "@/modules/directory/pages";
import { searchEnum } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header. The band's "needs a look" narrows the
// list in the address (`?show=failing|draft`, the page's ConnectionsFilters). The schema is here:
// the route's options load with the shell, and the directory's barrel would bring its API with it.
export const Route = createFileRoute("/_app/directory/connections/")({
  staticData: { capability: "connection.read", pageHeader: true },
  validateSearch: z.object({ show: searchEnum(["failing", "draft"]) }),
  component: ConnectionsRoute,
});

function ConnectionsRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ConnectionsPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
    />
  );
}
