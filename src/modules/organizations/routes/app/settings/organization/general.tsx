import { createFileRoute } from "@tanstack/react-router";

import { OrgGeneralPage } from "@/modules/organizations/pages";

export const Route = createFileRoute("/_app/settings/organization/general")({
  // Rebuilt on @qeetrix/react: the page draws its own header.
  staticData: { capability: "tenant.read", pageHeader: true },
  component: OrgGeneralPage,
});
