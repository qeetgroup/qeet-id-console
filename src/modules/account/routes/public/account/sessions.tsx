import { createFileRoute } from "@tanstack/react-router";

import { AccountSessionsPage } from "@/modules/account/pages";

export const Route = createFileRoute("/account/sessions")({
  component: AccountSessionsPage,
});
