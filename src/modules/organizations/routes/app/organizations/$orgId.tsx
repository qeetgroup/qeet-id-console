import { createFileRoute } from "@tanstack/react-router";

import { OrgPage } from "@/modules/organizations/pages";

// Rebuilt on @qeetrix/react: the page draws its own header. It has no tabs: an old `?tab=` link
// opens the page.
export const Route = createFileRoute("/_app/organizations/$orgId")({
  component: OrgRoute,
});

function OrgRoute() {
  const { orgId } = Route.useParams();
  return <OrgPage orgId={orgId} />;
}
