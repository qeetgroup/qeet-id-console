import { createFileRoute } from "@tanstack/react-router";

import { GroupDetailPage } from "@/modules/groups/pages";

export const Route = createFileRoute("/_app/groups/$groupId")({
  staticData: { capability: "group.read" },
  component: function GroupDetailRoute() {
    return <GroupDetailPage groupId={Route.useParams().groupId} />;
  },
});
