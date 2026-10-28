import { createFileRoute } from "@tanstack/react-router";

import { PasswordlessPage } from "@/modules/authentication/pages";

// Rebuilt on @qeetrix/react: the page draws its own header and the Sign-in tabs.
export const Route = createFileRoute("/_app/auth/login-methods/passwordless")({
  staticData: { capability: "policy.read" },
  component: PasswordlessPage,
});
