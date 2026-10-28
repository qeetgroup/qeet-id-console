import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ConnectionsListPage } from "@/modules/authentication/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Authentication › Connections: every connection in one list. Rebuilt on @qeetrix/react: the page
// draws its own header. Its search, kind and "needs a look" live in the address, so the header's
// numbers link into it. The schema is here: the route's options load with the shell.
export const Route = createFileRoute("/_app/auth/connections/")({
  staticData: { capability: "connection.read", pageHeader: true },
  validateSearch: z.object({
    q: searchText(),
    type: searchEnum(["signin", "provisioning", "apps"]),
    show: searchEnum(["attention", "setup"]),
  }),
  component: ConnectionsRoute,
});

function ConnectionsRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ConnectionsListPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
    />
  );
}
