import { createFileRoute } from "@tanstack/react-router";

import { ConsentGrantsPage } from "@/modules/authentication/pages";

export const Route = createFileRoute("/_app/auth/api/consent-grants")({
  component: ConsentGrantsPage,
});
