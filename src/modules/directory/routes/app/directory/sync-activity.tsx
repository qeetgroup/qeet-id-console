import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SyncActivityPage } from "@/modules/directory/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header. Its filters live in the address
// (sync-search.ts's ActivityFilters), so the band's links can narrow the list. The schema is here:
// the route's options load with the shell, and the directory's barrel would bring its API with it.
export const Route = createFileRoute("/_app/directory/sync-activity")({
  staticData: { capability: "connection.read" },
  validateSearch: z.object({
    period: searchEnum(["7d", "30d", "90d"]),
    connection: searchText(),
    result: searchEnum(["success", "failed"]),
    q: searchText(),
  }),
  component: SyncActivityRoute,
});

function SyncActivityRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <SyncActivityPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
    />
  );
}
