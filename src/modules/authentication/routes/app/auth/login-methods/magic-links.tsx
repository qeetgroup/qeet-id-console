import { createFileRoute } from "@tanstack/react-router";

import { MagicLinksPage } from "@/modules/authentication/pages";

// Rebuilt on @qeetrix/react: the page draws its own header and the Sign-in tabs.
export const Route = createFileRoute("/_app/auth/login-methods/magic-links")({
  staticData: { capability: "policy.read" },
  component: MagicLinksPage,
});
