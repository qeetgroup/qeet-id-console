import { createFileRoute } from "@tanstack/react-router";

import { CredentialsPage } from "@/modules/developer/pages";

export const Route = createFileRoute("/_app/developer/credentials")({
  component: CredentialsPage,
});
