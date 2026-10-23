import { createFileRoute } from "@tanstack/react-router";

import { InvitationsPage } from "@/modules/users/pages";
import { createIntentSearch } from "@/shared/hooks/use-create-intent";

export const Route = createFileRoute("/_app/invitations")({
  validateSearch: createIntentSearch,
  component: InvitationsPage,
});
