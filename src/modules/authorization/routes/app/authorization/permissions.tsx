import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PermissionsPage } from "@/modules/authorization/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header. Its filters live in the address, so
// the header's numbers can link into them.
const permissionsSearch = z.object({
  q: searchText(),
  resource: searchText(),
  role: searchText(),
  held: searchEnum(["everyone", "most", "some", "owners"]),
  look: searchEnum(["changes"]),
});

export const Route = createFileRoute("/_app/authorization/permissions")({
  staticData: { capability: "role.read" },
  validateSearch: permissionsSearch,
  component: PermissionsRoute,
});

function PermissionsRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PermissionsPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
    />
  );
}
