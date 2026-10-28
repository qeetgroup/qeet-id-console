import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SamlAppsPage } from "@/modules/authentication/pages";
import { searchEnum } from "@/shared/utils/search-params";

// SSO › SAML IdP: the apps Qeet ID signs people in to. `?action=create` opens Add app.
export const Route = createFileRoute("/_app/auth/connections/saml-idp")({
  staticData: { capability: "connection.read", pageHeader: true },
  validateSearch: z.object({ action: searchEnum(["create"]) }),
  component: SamlAppsRoute,
});

function SamlAppsRoute() {
  const { action } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <SamlAppsPage
      adding={action === "create"}
      onAddingChange={(open) =>
        navigate({ search: () => (open ? { action: "create" as const } : {}), replace: true })
      }
    />
  );
}
