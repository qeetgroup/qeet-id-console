import { createFileRoute } from "@tanstack/react-router";

import { OidcApplicationsPage } from "@/modules/authentication/pages";
import { createIntentSearch } from "@/shared/hooks/use-create-intent";

export const Route = createFileRoute("/_app/auth/connections/oidc/")({
  validateSearch: createIntentSearch, // `?action=create` opens the create drawer
  component: OidcApplicationsPage,
});
