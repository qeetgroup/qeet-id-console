import { createFileRoute } from "@tanstack/react-router";

import { groupsListSearch } from "@/modules/groups";
import { GroupsListPage } from "@/modules/groups/pages";

// Rebuilt on @qeetrix/react: the page draws its own header. Its filters live in the address, so
// a view of the list can be shared and the header's numbers can link into it. The schema comes
// from the barrel, not pages: the route's options load with the shell, its component later.
export const Route = createFileRoute("/_app/groups/")({
  staticData: { capability: "group.read", pageHeader: true },
  validateSearch: groupsListSearch,
  component: GroupsRoute,
});

function GroupsRoute() {
  // `action=create` opens the new-group sheet; the page reads it itself.
  const { action: _action, ...filters } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <GroupsListPage
      filters={filters}
      // An empty filter leaves the address, and typing doesn't pile up history entries.
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
    />
  );
}
