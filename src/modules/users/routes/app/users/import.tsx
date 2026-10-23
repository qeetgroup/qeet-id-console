import { createFileRoute } from "@tanstack/react-router";

import { ImportUsersPage } from "@/modules/users/pages";

export const Route = createFileRoute("/_app/users/import")({
  staticData: { capability: "user.write" },
  component: ImportUsersPage,
});
