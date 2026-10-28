import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import { activitySearchSchema } from "@/modules/activity";
import { ActivityPage, type ActivityPageProps } from "@/modules/activity/pages";

// Rebuilt on @qeetrix/react: the page draws its own header. Its filters, range and open event live
// in the address (other pages link to one event with `?range=custom&from=…&to=…&event=<id>`). The
// schema comes from the barrel, which the shell carries already (the Dashboard reads the feed).
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
