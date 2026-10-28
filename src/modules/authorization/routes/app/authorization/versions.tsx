import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PolicyVersionsPage } from "@/modules/authorization/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header, with the Policies tabs. Its filters and
// the open version live in the address.
const versionsSearch = z.object({
  q: searchText(),
  policy: searchText(),
  actor: searchText(),
  change: searchEnum(["created", "changed", "deleted"]),
  look: searchEnum(["week"]),
  version: searchText(),
});

export const Route = createFileRoute("/_app/authorization/versions")({
  staticData: { capability: "policy.read" },
  validateSearch: versionsSearch,
  component: VersionsRoute,
});

function VersionsRoute() {
  const { version, ...filters } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PolicyVersionsPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
      open={version}
      onOpenChange={(next) => navigate({ search: (prev) => ({ ...prev, version: next }) })}
    />
  );
}
