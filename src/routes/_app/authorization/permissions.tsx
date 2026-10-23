import { createFileRoute } from "@tanstack/react-router";

import { PermissionsPage } from "@/modules/authorization/pages";

export const Route = createFileRoute("/_app/authorization/permissions")({
  component: PermissionsPage,
});
