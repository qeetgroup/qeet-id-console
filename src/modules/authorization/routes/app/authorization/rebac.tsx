import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RebacPage } from "@/modules/authorization/pages";
import { searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header. The object open and the relation
// expanded live in the address, so a graph can be shared.
const rebacSearch = z.object({ object: searchText(), relation: searchText() });

export const Route = createFileRoute("/_app/authorization/rebac")({
  staticData: { capability: "role.read", pageHeader: true },
  validateSearch: rebacSearch,
  component: RebacRoute,
});

function RebacRoute() {
  const { object, relation } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <RebacPage
      object={object}
      relation={relation}
      onOpen={(next, rel) => navigate({ search: { object: next, relation: rel } })}
    />
  );
}
