import { createFileRoute } from "@tanstack/react-router";

import { TotpPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/mfa/totp")({
  component: TotpPage,
});
