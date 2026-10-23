import { createFileRoute } from "@tanstack/react-router";

import { ScimPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/connections/scim")({
  staticData: { capability: "connection.read" },
  component: ScimPage,
});
