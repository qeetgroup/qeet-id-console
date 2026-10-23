import { createFileRoute } from "@tanstack/react-router";

import { TokensPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/api/tokens")({
  staticData: { capability: "connection.read" },
  component: TokensPage,
});
