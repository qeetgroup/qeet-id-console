import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SsoListPage } from "@/modules/authentication/pages";
import { searchEnum, searchText } from "@/shared/utils/search-params";

// Authentication › SSO: the SAML connections and SAML apps in one list, then the setup links. Its
// search, kind and "needs a look" live in the address, so the header's numbers link into it;
// `?action=create` opens the New SAML connection drawer. /auth/connections redirects here. The
// schema is here: the route's options load with the shell.
export const Route = createFileRoute("/_app/auth/connections/saml/")({
  staticData: { capability: "connection.read", pageHeader: true },
  validateSearch: z.object({
    action: searchEnum(["create"]),
    q: searchText(),
    type: searchEnum(["signin", "apps"]),
    show: searchEnum(["attention", "setup"]),
  }),
  component: SsoRoute,
});

function SsoRoute() {
  const { action, ...filters } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <SsoListPage
      filters={filters}
      onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
      creating={action === "create"}
      onCreatingChange={(open) =>
        navigate({
          search: (prev) => ({ ...prev, action: open ? ("create" as const) : undefined }),
          replace: true,
        })
      }
    />
  );
}
