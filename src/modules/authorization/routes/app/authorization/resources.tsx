import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ResourcesPage } from "@/modules/authorization/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header. Its filters and the open resource live
// in the address.
const resourcesSearch = z.object({
  q: searchText(),
  by: searchEnum(["qeet", "policy"]),
  guard: searchEnum(["roles", "both", "policies"]),
  look: searchEnum(["off", "open"]),
  resource: searchText(),
});

export const Route = createFileRoute("/_app/authorization/resources")({
  staticData: { capability: "role.read" },
  validateSearch: resourcesSearch,
  component: ResourcesRoute,
});

function ResourcesRoute() {
  const { resource, ...filters } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ResourcesPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
      open={resource}
      onOpenChange={(next) => navigate({ search: (prev) => ({ ...prev, resource: next }) })}
    />
  );
}
