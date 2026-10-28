import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { MappingsPage } from "@/modules/directory/pages";
import { searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header. `?connection=` is the connection whose
// mappings are on show (the first without it), so Sync errors can link to one.
export const Route = createFileRoute("/_app/directory/attribute-mappings")({
  staticData: { capability: "connection.read" },
  validateSearch: z.object({ connection: searchText() }),
  component: MappingsRoute,
});

function MappingsRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <MappingsPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
    />
  );
}
