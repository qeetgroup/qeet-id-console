import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ConsentGrantsPage } from "@/modules/authentication/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header, and its search and filters live in
// the address (`?q=…&app=<client id>&access=profile|email|phone`). The schema is here: the route's
// options load with the shell, and the module's barrel would bring its API with it.
export const Route = createFileRoute("/_app/auth/api/consent-grants")({
  staticData: { capability: "connection.read" },
  validateSearch: z.object({
    q: searchText(),
    app: searchText(),
    access: searchEnum(["profile", "email", "phone"]),
  }),
  component: ConsentGrantsRoute,
});

function ConsentGrantsRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ConsentGrantsPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
    />
  );
}
