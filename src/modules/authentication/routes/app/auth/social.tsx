import { createFileRoute } from "@tanstack/react-router";

import { SocialProvidersPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/social")({
  staticData: { capability: "connection.read" },
  component: SocialProvidersPage,
});
