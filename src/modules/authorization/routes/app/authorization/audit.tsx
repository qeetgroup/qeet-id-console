import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AuthorizationAuditPage } from "@/modules/authorization/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header. Its filters (sent to the server) and
// the open change live in the address. Reading the audit log needs audit.read, as on the server.
const auditSearch = z.object({
  q: searchText(),
  kind: searchEnum(["policies", "roles", "groupRoles", "relationships"]),
  actor: searchText(),
  event: searchText(),
});

export const Route = createFileRoute("/_app/authorization/audit")({
  staticData: { capability: "audit.read" },
  validateSearch: auditSearch,
  component: AuditRoute,
});

function AuditRoute() {
  const { event, ...filters } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AuthorizationAuditPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
      open={event}
      onOpenChange={(next) => navigate({ search: (prev) => ({ ...prev, event: next }) })}
    />
  );
}
