import { createFileRoute } from "@tanstack/react-router";

import { DomainsPage } from "@/modules/organizations/pages";

export const Route = createFileRoute("/_app/settings/organization/domains")({
  // Rebuilt on @qeetrix/react: the page draws its own header.
  staticData: { capability: "tenant.read" },
  component: DomainsPage,
});
