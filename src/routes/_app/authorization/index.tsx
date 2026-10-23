import { createFileRoute } from "@tanstack/react-router";

import { AuthorizationOverviewPage } from "@/modules/authorization/pages";

export const Route = createFileRoute("/_app/authorization/")({
  component: AuthorizationOverviewPage,
});
