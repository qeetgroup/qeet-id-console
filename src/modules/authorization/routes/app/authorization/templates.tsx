import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PolicyTemplatesPage } from "@/modules/authorization/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header, with the Policies tabs. Its filters and
// the open template live in the address.
const templatesSearch = z.object({
  q: searchText(),
  category: searchEnum(["saas", "cloud", "regulated", "baseline"]),
  effect: searchEnum(["allow", "deny"]),
  template: searchText(),
});

export const Route = createFileRoute("/_app/authorization/templates")({
  staticData: { capability: "policy.read", pageHeader: true },
  validateSearch: templatesSearch,
  component: TemplatesRoute,
});

function TemplatesRoute() {
  const { template, ...filters } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PolicyTemplatesPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
      open={template}
      onOpenChange={(next) => navigate({ search: (prev) => ({ ...prev, template: next }) })}
    />
  );
}
