import { createFileRoute } from "@tanstack/react-router";

import { TotpPage } from "@/modules/authentication/pages";

// Rebuilt on @qeetrix/react: the page draws its own header and the MFA tabs. The signed-in
// person's own authenticator app, so it needs no capability.
export const Route = createFileRoute("/_app/auth/mfa/totp")({
  component: TotpPage,
});
