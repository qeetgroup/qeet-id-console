import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AcceptInvitePage } from "@/modules/authentication/entry-pages";

export const Route = createFileRoute("/_auth/invite/accept")({
  // Without a token the page explains the link is incomplete.
  validateSearch: z.object({ token: z.string().catch("") }),
  component: function AcceptInviteRoute() {
    return (
      <AcceptInvitePage token={Route.useSearch().token} session={Route.useRouteContext().session} />
    );
  },
});
