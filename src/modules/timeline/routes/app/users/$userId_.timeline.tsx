import { createFileRoute } from "@tanstack/react-router";

import { IdentityTimelinePage } from "@/modules/timeline/pages";

export const Route = createFileRoute("/_app/users/$userId_/timeline")({
  staticData: { capability: "user.read" },
  component: function UserTimelineRoute() {
    return <IdentityTimelinePage userId={Route.useParams().userId} />;
  },
});
