import { createFileRoute } from "@tanstack/react-router";

import { PermissionsPage } from "@/modules/authorization/pages";

export const Route = createFileRoute("/_app/authorization/permissions")({
  staticData: { capability: "role.read" },
  component: PermissionsPage,
});
