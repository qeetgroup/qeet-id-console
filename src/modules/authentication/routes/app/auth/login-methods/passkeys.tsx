import { createFileRoute } from "@tanstack/react-router";

import { PasskeysPage } from "@/modules/authentication/pages";

// Rebuilt on @qeetrix/react: the page draws its own header and the Sign-in tabs. The signed-in
// person's own passkeys, so it needs no capability.
export const Route = createFileRoute("/_app/auth/login-methods/passkeys")({
  component: PasskeysPage,
});
