import { createFileRoute } from "@tanstack/react-router";

import { MagicLinksPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/login-methods/magic-links")({
  staticData: { capability: "policy.read" },
  component: MagicLinksPage,
});
