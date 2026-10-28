import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { BotsPage } from "@/modules/security/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header. Its filters live in the address.
const botsSearch = z.object({
  q: searchText(),
  verdict: searchEnum(["blocked", "challenged", "allowed"]),
});

export const Route = createFileRoute("/_app/security/threats/bots")({
  staticData: { capability: "policy.read" },
  validateSearch: botsSearch,
  component: BotsRoute,
});

function BotsRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <BotsPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
    />
  );
}
