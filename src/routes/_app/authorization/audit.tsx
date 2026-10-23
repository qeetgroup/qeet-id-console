import { createFileRoute } from "@tanstack/react-router";

import { AuthorizationAuditPage } from "@/modules/authorization/pages";

export const Route = createFileRoute("/_app/authorization/audit")({
  component: AuthorizationAuditPage,
});
