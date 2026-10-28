import { createFileRoute } from "@tanstack/react-router";

import { SocialPage } from "@/modules/authentication/pages";

// Rebuilt on @qeetrix/react: the page draws its own header.
export const Route = createFileRoute("/_app/auth/social")({
  staticData: { capability: "connection.read", pageHeader: true },
  component: SocialPage,
});
