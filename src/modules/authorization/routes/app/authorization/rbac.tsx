import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RbacPage } from "@/modules/authorization/pages";
import { searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header, with the Models tabs. Its search and
// the open role live in the address.
const rbacSearch = z.object({ q: searchText(), resource: searchText(), role: searchText() });

export const Route = createFileRoute("/_app/authorization/rbac")({
  staticData: { capability: "role.read" },
  validateSearch: rbacSearch,
  component: RbacRoute,
});

function RbacRoute() {
  const { role, ...filters } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RbacPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
      roleId={role}
      onRoleChange={(next) => navigate({ search: (prev) => ({ ...prev, role: next }) })}
    />
  );
}
