import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { EvidencePage } from "@/modules/compliance/pages";
import { searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header; the run on show is in the address.
export const Route = createFileRoute("/_app/security/compliance/iso27001")({
  staticData: { capability: "audit.read", pageHeader: true },
  validateSearch: z.object({ run: searchText() }),
  component: Iso27001Route,
});

function Iso27001Route() {
  const { run } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <EvidencePage
      framework="iso27001"
      runId={run}
      onRunChange={(next) => navigate({ search: { run: next } })}
    />
  );
}
