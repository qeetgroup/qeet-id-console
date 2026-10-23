import { createFileRoute } from "@tanstack/react-router";

import { RolesPage } from "@/modules/authorization/pages";

export const Route = createFileRoute("/_app/authorization/roles")({
  component: RolesPage,
});
