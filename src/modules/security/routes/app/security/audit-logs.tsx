import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AuditLogPage } from "@/modules/security/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header. Its filters, its view (Flagged) and
// the event open in its drawer live in the address, so a view or an event can be shared. The
// schema is here, small, because the route's options load with the shell.
const auditSearch = z.object({
  q: searchText(),
  action: searchText(),
  resource_type: searchText(),
  actor_user_id: searchText(),
  view: searchEnum(["flagged"]),
  status: searchEnum(["resolved"]),
  event: searchText(),
});

export const Route = createFileRoute("/_app/security/audit-logs")({
  staticData: { capability: "audit.read", pageHeader: true },
  validateSearch: auditSearch,
  component: AuditLogsRoute,
});

function AuditLogsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AuditLogPage
      search={search}
      // An empty filter leaves the address; typing replaces the entry, opening an event adds one.
      onSearchChange={(next, options) =>
        navigate({ search: () => next, replace: options?.replace ?? true })
      }
    />
  );
}
