import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AnalyticsPage } from "@/modules/dashboard/pages";
import { searchEnum } from "@/shared/utils/search-params";

// Rebuilt on @qeetrix/react: the page draws its own header, and the range is in the address. The
// schema is here (not the model's RANGES): the route's options load with the shell.
export const Route = createFileRoute("/_app/analytics")({
  staticData: { capability: "analytics.read" },
  validateSearch: z.object({ range: searchEnum(["7d", "30d", "90d"]) }),
  component: AnalyticsRoute,
});

function AnalyticsRoute() {
  const { range = "30d" } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AnalyticsPage
      range={range}
      onRangeChange={(next) =>
        navigate({ search: { range: next === "30d" ? undefined : next }, replace: true })
      }
    />
  );
}
