import { createFileRoute } from "@tanstack/react-router";

import { AccountSecurityPage } from "@/modules/account/pages";

export const Route = createFileRoute("/_app/account/security")({
  component: AccountSecurityPage,
});
