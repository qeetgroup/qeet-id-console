import { createFileRoute } from "@tanstack/react-router";

import { SecretsPage } from "@/modules/developer/pages";

export const Route = createFileRoute("/_app/auth/api/secrets")({
  staticData: { capability: "secret.read" },
  component: SecretsPage,
});
