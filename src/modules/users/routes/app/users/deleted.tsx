import { createFileRoute } from "@tanstack/react-router";

import { DeletedUsersPage } from "@/modules/users/pages";

export const Route = createFileRoute("/_app/users/deleted")({
  staticData: { capability: "user.read" },
  component: DeletedUsersPage,
});
