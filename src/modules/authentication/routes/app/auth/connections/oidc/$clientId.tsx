import { createFileRoute } from "@tanstack/react-router";

import { OidcApplicationPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/connections/oidc/$clientId")({
  staticData: { capability: "connection.read" },
  component: function OidcApplicationRoute() {
    return <OidcApplicationPage clientId={Route.useParams().clientId} />;
  },
});
