import { createFileRoute } from "@tanstack/react-router";

import { SsoCallbackPage } from "@/modules/authentication/entry-pages";

export const Route = createFileRoute("/_auth/sso/callback")({
  component: SsoCallbackPage,
});
