import { createFileRoute } from "@tanstack/react-router";

import { SamlProvidersPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/connections/saml-idp")({
  component: SamlProvidersPage,
});
