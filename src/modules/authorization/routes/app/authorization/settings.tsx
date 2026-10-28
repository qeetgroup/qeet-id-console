import { createFileRoute } from "@tanstack/react-router";

import { AuthorizationSettingsPage } from "@/modules/authorization/pages";

export const Route = createFileRoute("/_app/authorization/settings")({
  staticData: { capability: "role.read", pageHeader: true },
  component: AuthorizationSettingsPage,
});
