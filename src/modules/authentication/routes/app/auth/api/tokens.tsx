import { createFileRoute } from "@tanstack/react-router";

import { TokensPage } from "@/modules/authentication/pages";

// Rebuilt on @qeetrix/react: the page draws its own header.
export const Route = createFileRoute("/_app/auth/api/tokens")({
  staticData: { capability: "connection.read" },
  component: TokensPage,
});
