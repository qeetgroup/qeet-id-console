import { createFileRoute } from "@tanstack/react-router";

import { ConnectionsPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/connections/")({
  component: ConnectionsPage,
});
