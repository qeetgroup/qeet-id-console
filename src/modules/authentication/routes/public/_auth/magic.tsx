import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { MagicLinkPage } from "@/modules/authentication/pages";
import { searchText } from "@/shared/utils/search-params";

export const Route = createFileRoute("/_auth/magic")({
  // The emailed link carries the token; without one the page asks for a link.
  validateSearch: z.object({ token: searchText() }),
  component: function MagicLinkRoute() {
    return <MagicLinkPage token={Route.useSearch().token} />;
  },
});
