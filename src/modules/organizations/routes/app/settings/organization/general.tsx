import { createFileRoute } from "@tanstack/react-router";

import { OrgGeneralPage } from "@/modules/organizations/pages";

export const Route = createFileRoute("/_app/settings/organization/general")({
  staticData: { capability: "tenant.read" },
  component: OrgGeneralPage,
});
