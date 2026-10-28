import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AnomaliesPage } from "@/modules/security/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header. Its filters live in the address, so
// the header's numbers can link into them. The server's list is under policy.read.
const anomaliesSearch = z.object({
  q: searchText(),
  status: searchEnum(["open", "resolved"]),
  type: searchEnum(["credential_stuffing", "password_spraying"]),
});

export const Route = createFileRoute("/_app/security/threats/anomalies")({
  staticData: { capability: "policy.read" },
  validateSearch: anomaliesSearch,
  component: AnomaliesRoute,
});

function AnomaliesRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AnomaliesPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
    />
  );
}
