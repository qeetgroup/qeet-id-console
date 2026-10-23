import { createFileRoute } from "@tanstack/react-router";

import { AuthHooksPage } from "@/modules/developer/pages";

export const Route = createFileRoute("/_app/developer/auth-hooks")({
  component: AuthHooksPage,
});
