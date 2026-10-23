import { createFileRoute } from "@tanstack/react-router";

import { PasskeysPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/login-methods/passkeys")({
  component: PasskeysPage,
});
