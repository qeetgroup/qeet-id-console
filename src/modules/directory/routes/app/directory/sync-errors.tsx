import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SyncErrorsPage } from "@/modules/directory/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header. Its filters live in the address
// (sync-search.ts's ErrorsFilters), so the band's links can narrow the list. The schema is here:
// the route's options load with the shell, and the directory's barrel would bring its API with it.
export const Route = createFileRoute("/_app/directory/sync-errors")({
  staticData: { capability: "connection.read" },
  validateSearch: z.object({
    period: searchEnum(["7d", "30d", "90d"]),
    connection: searchText(),
    status: searchEnum(["open", "resolved", "retried"]),
    severity: searchEnum(["critical", "warning"]),
    q: searchText(),
  }),
  component: SyncErrorsRoute,
});

function SyncErrorsRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <SyncErrorsPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
    />
  );
}
