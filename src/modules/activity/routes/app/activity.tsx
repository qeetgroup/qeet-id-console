import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import { activitySearchSchema } from "@/modules/activity";
import { ActivityPage, type ActivityPageProps } from "@/modules/activity/pages";

export const Route = createFileRoute("/_app/activity")({
  staticData: { capability: "audit.read" },
  validateSearch: activitySearchSchema,
  component: ActivityRoute,
});

function ActivityRoute() {
  const navigate = Route.useNavigate();
  const onSearchChange = useCallback<ActivityPageProps["onSearchChange"]>(
    (update, options) => navigate({ search: update, replace: options?.replace }),
    [navigate],
  );
  return <ActivityPage search={Route.useSearch()} onSearchChange={onSearchChange} />;
}
