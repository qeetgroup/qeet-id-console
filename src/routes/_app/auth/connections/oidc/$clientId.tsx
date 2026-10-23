import { createFileRoute } from "@tanstack/react-router";

import { OidcApplicationPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/connections/oidc/$clientId")({
  component: function OidcApplicationRoute() {
    return <OidcApplicationPage clientId={Route.useParams().clientId} />;
  },
});
