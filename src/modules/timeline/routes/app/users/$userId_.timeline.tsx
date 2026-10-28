import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PersonTimelinePage } from "@/modules/timeline/pages";
import { searchEnum } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header. Its period and filters live in the
// address (`?period=7d|90d`, 30 days without; `kind` a server category; `result=failed`), so the
// band's numbers can link into the list and a view can be shared. The schema is here: the route's
// options load with the shell.
export const Route = createFileRoute("/_app/users/$userId_/timeline")({
  staticData: { capability: "user.read", pageHeader: true },
  validateSearch: z.object({
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
  component: function TimelineRoute() {
    const navigate = Route.useNavigate();
    return (
      <PersonTimelinePage
        userId={Route.useParams().userId}
        filters={Route.useSearch()}
        onFiltersChange={(next) => navigate({ search: () => next, replace: true })}
      />
    );
  },
});
