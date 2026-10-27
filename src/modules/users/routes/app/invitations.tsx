import { createFileRoute } from "@tanstack/react-router";

import { invitationsSearch } from "@/modules/users";
import { InvitationsPage } from "@/modules/users/pages";

// Rebuilt on @qeetrix/react: the page draws its own header, and its filters live in the address.
export const Route = createFileRoute("/_app/invitations")({
  staticData: { capability: "user.read", pageHeader: true },
  validateSearch: invitationsSearch,
  component: InvitationsRoute,
});

function InvitationsRoute() {
  // `action=create` opens the Add people drawer; the page reads it itself.
  const { action: _action, ...filters } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <InvitationsPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
    />
  );
}
