import { createFileRoute } from "@tanstack/react-router";

import { DomainsPage } from "@/modules/organizations/pages";

export const Route = createFileRoute("/_app/settings/organization/domains")({
  component: DomainsPage,
});
