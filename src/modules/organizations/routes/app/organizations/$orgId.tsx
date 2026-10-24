import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ORG_TABS } from "@/modules/organizations";
import { OrgDetailPage } from "@/modules/organizations/pages";
import { searchEnum } from "@/shared/utils/search-params";

export const Route = createFileRoute("/_app/organizations/$orgId")({
  validateSearch: z.object({ tab: searchEnum(ORG_TABS) }), // no tab opens Overview
  component: OrgDetailRoute,
});

function OrgDetailRoute() {
  const { orgId } = Route.useParams();
  const tab = Route.useSearch().tab ?? "overview";
  const navigate = Route.useNavigate();
  return (
    <OrgDetailPage
      orgId={orgId}
      tab={tab}
      onTabChange={(next) => navigate({ search: (p) => ({ ...p, tab: next }), replace: true })}
    />
  );
}
