import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AuditLogsPage } from "@/modules/security/pages";
import { searchText } from "@/shared/utils/search-params";

// Filters live in the URL so a triage view can be shared.
const auditSearch = z.object({
  q: searchText(),
  action: searchText(),
  resource_type: searchText(),
  actor_user_id: searchText(),
});

export const Route = createFileRoute("/_app/security/audit-logs")({
  staticData: { capability: "audit.read" },
  validateSearch: auditSearch,
  component: AuditLogsRoute,
});

function AuditLogsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AuditLogsPage
      filters={{
        q: search.q ?? "",
        action: search.action ?? "",
        resource_type: search.resource_type ?? "",
        actor_user_id: search.actor_user_id ?? "",
      }}
      // An empty filter leaves the URL, and typing doesn't pile up history entries.
      onFiltersChange={(next) =>
        navigate({
          search: () => ({
            q: next.q || undefined,
            action: next.action || undefined,
            resource_type: next.resource_type || undefined,
            actor_user_id: next.actor_user_id || undefined,
          }),
          replace: true,
        })
      }
    />
  );
}
