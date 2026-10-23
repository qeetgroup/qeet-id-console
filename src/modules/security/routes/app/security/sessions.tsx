import { createFileRoute } from "@tanstack/react-router";

import { SecuritySessionsPage } from "@/modules/security/pages";

export const Route = createFileRoute("/_app/security/sessions")({
  component: SecuritySessionsPage,
});
