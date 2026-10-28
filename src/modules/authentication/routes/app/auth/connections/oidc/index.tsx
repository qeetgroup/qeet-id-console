import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { OidcAppsPage } from "@/modules/authentication/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Applications (/applications redirects here). Rebuilt on @qeetrix/react: the page draws its own
// header. Its search, kind and "needs a look" live in the address; `?action=create` opens Register
// application. The schema is here: the route's options load with the shell.
export const Route = createFileRoute("/_app/auth/connections/oidc/")({
  staticData: { capability: "connection.read", pageHeader: true },
  validateSearch: z.object({
    action: searchEnum(["create"]),
    q: searchText(),
    kind: searchEnum(["web", "spa", "mobile", "cli", "service"]),
    look: searchEnum(["pkce", "localhost"]),
  }),
  component: OidcAppsRoute,
});

function OidcAppsRoute() {
  const { action, ...filters } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <OidcAppsPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
      registering={action === "create"}
      onRegisteringChange={(open) =>
        navigate({
          search: (prev) => ({ ...prev, action: open ? ("create" as const) : undefined }),
          replace: true,
        })
      }
    />
  );
}
