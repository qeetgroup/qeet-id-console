import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { EvidencePage } from "@/modules/compliance/pages";
import { searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header; the run on show is in the address.
export const Route = createFileRoute("/_app/security/compliance/soc2")({
  staticData: { capability: "audit.read" },
  validateSearch: z.object({ run: searchText() }),
  component: Soc2Route,
});

function Soc2Route() {
  const { run } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <EvidencePage
      framework="soc2"
      runId={run}
      onRunChange={(next) => navigate({ search: { run: next } })}
    />
  );
}
