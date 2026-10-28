import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AbacPage } from "@/modules/authorization/pages";
import { searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header. The policy open lives in the address
// (`new` for a new one), so Testing can link to the policy that decided a check.
const abacSearch = z.object({ policy: searchText() });

export const Route = createFileRoute("/_app/authorization/abac")({
  staticData: { capability: "policy.read" },
  validateSearch: abacSearch,
  component: AbacRoute,
});

function AbacRoute() {
  const { policy } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AbacPage
      policyId={policy}
      onPolicyChange={(next) => navigate({ search: { policy: next }, replace: true })}
    />
  );
}
