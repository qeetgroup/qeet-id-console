import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { TestingPage } from "@/modules/authorization/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// One page for every what-if question; the Access tester, Simulator and Explorer addresses send
// here. `mode` is the question, `user` a person to ask about.
const testingSearch = z.object({
  mode: searchEnum(["permission", "relationship", "attributes", "authzen"]),
  user: searchText(),
});

export const Route = createFileRoute("/_app/authorization/testing")({
  staticData: { capability: "role.read" },
  validateSearch: testingSearch,
  component: TestingRoute,
});

function TestingRoute() {
  const { mode = "permission", user } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <TestingPage
      mode={mode}
      userId={user}
      onModeChange={(next) => navigate({ search: (s) => ({ ...s, mode: next }), replace: true })}
    />
  );
}
