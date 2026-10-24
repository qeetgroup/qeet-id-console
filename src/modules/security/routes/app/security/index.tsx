import { createFileRoute } from "@tanstack/react-router";

import { SecurityOverviewPage } from "@/modules/security/pages";

export const Route = createFileRoute("/_app/security/")({
  component: SecurityOverviewPage,
});
