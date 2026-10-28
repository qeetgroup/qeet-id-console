import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { DevicesPage } from "@/modules/security/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header. Its filters live in the address, so
// the header's numbers can link into them.
const devicesSearch = z.object({
  q: searchText(),
  status: searchEnum(["waiting", "approved", "denied", "expired"]),
  app: searchText(),
});

export const Route = createFileRoute("/_app/security/device-authorizations")({
  staticData: { capability: "connection.read" },
  validateSearch: devicesSearch,
  component: DevicesRoute,
});

function DevicesRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <DevicesPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
    />
  );
}
