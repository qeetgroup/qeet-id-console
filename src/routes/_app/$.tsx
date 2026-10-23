import { createFileRoute } from "@tanstack/react-router";

import { PlaceholderPage } from "@/modules/dashboard/pages";

// A navigation entry with no screen yet lands here rather than on a 404.
export const Route = createFileRoute("/_app/$")({
  component: function PlaceholderRoute() {
    return <PlaceholderPage path={Route.useParams()._splat ?? ""} />;
  },
});
