import { createFileRoute } from "@tanstack/react-router";

import { RbacPage } from "@/modules/authorization/pages";

export const Route = createFileRoute("/_app/authorization/rbac")({
  staticData: { capability: "role.read" },
  component: RbacPage,
});
