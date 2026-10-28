import { createFileRoute } from "@tanstack/react-router";

import { RolesPage } from "@/modules/authorization/pages";
import { createIntentSearch } from "@/shared/hooks/use-create-intent";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header. The filters and the open role live in
// the address, so a view can be shared and the header's numbers link into it. The schema is defined
// here, light: a route's options load with the shell, its component later.
const rolesSearch = createIntentSearch.extend({
  q: searchText(),
  type: searchEnum(["custom", "builtin"]),
  look: searchEnum(["unused", "every", "empty"]),
  role: searchText(),
});

export const Route = createFileRoute("/_app/authorization/roles")({
  staticData: { capability: "role.read" },
  validateSearch: rolesSearch,
  component: RolesRoute,
});

function RolesRoute() {
  // `action=create` opens the new-role drawer; the page reads it itself.
  const { action: _action, role, ...filters } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RolesPage
      filters={filters}
      // An empty filter leaves the address, and typing doesn't pile up history entries.
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
      roleId={role}
      onRoleChange={(next) => navigate({ search: (prev) => ({ ...prev, role: next }) })}
    />
  );
}
