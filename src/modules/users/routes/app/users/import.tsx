import { createFileRoute } from "@tanstack/react-router";

import { ImportUsersPage } from "@/modules/users/pages";

// Rebuilt on @qeetrix/react: the page draws its own header.
export const Route = createFileRoute("/_app/users/import")({
  staticData: { capability: "user.write", pageHeader: true },
  component: ImportUsersPage,
});
