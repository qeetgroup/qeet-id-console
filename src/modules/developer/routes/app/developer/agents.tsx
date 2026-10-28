import { createFileRoute } from "@tanstack/react-router";

import { machineSearch } from "@/modules/developer";
import { MachineAccessPage } from "@/modules/developer/pages";

// Rebuilt on @qeetrix/react: Machine access › Agents, one of its tabs. The page draws its own header;
// its filters live in the address, so the header's numbers link into them. The schema comes from
// the barrel, not pages: the route's options load with the shell, its component later.
export const Route = createFileRoute("/_app/developer/agents")({
  staticData: { capability: "apikey.read" },
  validateSearch: machineSearch,
  component: function MachineAccessRoute() {
    // `action=create` opens the tab's create drawer; the page reads it itself.
    const { action: _action, ...filters } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <MachineAccessPage
        tab="agent"
        filters={filters}
        // An empty filter leaves the address, and typing doesn't pile up history entries.
        onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
      />
    );
  },
});
