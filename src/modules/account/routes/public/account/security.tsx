import { createFileRoute } from "@tanstack/react-router";

import { AccountSecurityPage } from "@/modules/account/pages";

export const Route = createFileRoute("/account/security")({
  component: AccountSecurityPage,
});
