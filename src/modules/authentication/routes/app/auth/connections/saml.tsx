import { createFileRoute } from "@tanstack/react-router";

import { SamlConnectionsPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/connections/saml")({
  staticData: { capability: "connection.read" },
  component: SamlConnectionsPage,
});
