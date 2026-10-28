import { createFileRoute } from "@tanstack/react-router";

import { SamlConnectionPage } from "@/modules/authentication/pages";

// One SAML sign-in connection's setup page.
export const Route = createFileRoute("/_app/auth/connections/saml/$id")({
  staticData: { capability: "connection.read", pageHeader: true },
  component: function SamlConnectionRoute() {
    return <SamlConnectionPage id={Route.useParams().id} />;
  },
});
