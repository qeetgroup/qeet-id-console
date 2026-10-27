import { createFileRoute } from "@tanstack/react-router";

import { deletedSearch } from "@/modules/users";
import { DeletedUsersPage } from "@/modules/users/pages";

// Rebuilt on @qeetrix/react: the page draws its own header, and its filters live in the address.
export const Route = createFileRoute("/_app/users/deleted")({
  staticData: { capability: "user.read", pageHeader: true },
  validateSearch: deletedSearch,
  component: DeletedRoute,
});

function DeletedRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <DeletedUsersPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
    />
  );
}
