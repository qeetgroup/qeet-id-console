import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { USER360_TABS, user360Tab } from "@/modules/users";
import { UserDetailPage } from "@/modules/users/pages";
import { searchEnum } from "@/shared/utils/search-params";

// The person's views are the page's tabs. No tab opens Overview; an old `?tab=identities` opens
// Security, which holds it now. The Activity view (the timeline module's) keeps its period and
// filters here too; its schema is spelt out rather than read from the timeline barrel, which would
// bring the view into the shell with the route's options.
export const Route = createFileRoute("/_app/users/$userId")({
  staticData: { capability: "user.read" },
  validateSearch: z.object({
    tab: z.preprocess(user360Tab, z.enum(USER360_TABS).optional()),
    period: searchEnum(["7d", "30d", "90d"]),
    kind: searchEnum([
      "authentication",
      "authorization",
      "directory",
      "security",
      "developer",
      "system",
    ]),
    result: searchEnum(["failed"]),
  }),
  component: UserDetailRoute,
});

function UserDetailRoute() {
  const { userId } = Route.useParams();
  const { tab = "overview", ...activity } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <UserDetailPage
      userId={userId}
      tab={tab}
      onTabChange={(next) =>
        navigate({ search: { tab: next === "overview" ? undefined : next }, replace: true })
      }
      activity={activity}
      onActivityChange={(next) => navigate({ search: { tab: "activity", ...next }, replace: true })}
    />
  );
}
