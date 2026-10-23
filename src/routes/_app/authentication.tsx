import { createFileRoute } from "@tanstack/react-router";

import { AuthenticationOverview } from "@/modules/dashboard";

export const Route = createFileRoute("/_app/authentication")({
  component: AuthenticationOverview,
});
