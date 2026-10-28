import { createFileRoute } from "@tanstack/react-router";

import { GroupPage } from "@/modules/groups/pages";

// Rebuilt on @qeetrix/react: the page draws its own header (its path as the breadcrumb).
export const Route = createFileRoute("/_app/groups/$groupId")({
  staticData: { capability: "group.read", pageHeader: true },
  component: function GroupRoute() {
    return <GroupPage groupId={Route.useParams().groupId} />;
  },
});
