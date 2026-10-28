import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { OidcAppPage } from "@/modules/authentication/pages";
import { searchEnum } from "@/shared/utils/search-params";

// One application: its Overview, or `?tab=integrate`.
export const Route = createFileRoute("/_app/auth/connections/oidc/$clientId")({
  staticData: { capability: "connection.read", pageHeader: true },
  validateSearch: z.object({ tab: searchEnum(["integrate"]) }),
  component: function OidcAppRoute() {
    const { tab } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <OidcAppPage
        clientId={Route.useParams().clientId}
        tab={tab ?? "overview"}
        onTabChange={(next) =>
          navigate({ search: () => (next === "integrate" ? { tab: next } : {}), replace: true })
        }
      />
    );
  },
});
