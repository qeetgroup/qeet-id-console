import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SamlIndexPage } from "@/modules/authentication/pages";
import { searchEnum } from "@/shared/utils/search-params";

// SSO › SAML: the one connection's setup page (`/saml/$id`), the list for several, or how to start
// one. `?action=create` opens the New connection drawer.
export const Route = createFileRoute("/_app/auth/connections/saml/")({
  staticData: { capability: "connection.read", pageHeader: true },
  validateSearch: z.object({ action: searchEnum(["create"]) }),
  component: SamlIndexRoute,
});

function SamlIndexRoute() {
  const { action } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <SamlIndexPage
      creating={action === "create"}
      onCreatingChange={(open) =>
        navigate({ search: () => (open ? { action: "create" as const } : {}), replace: true })
      }
    />
  );
}
