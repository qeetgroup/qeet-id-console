import { createFileRoute } from "@tanstack/react-router";

import { UsersPage } from "@/modules/users/pages";
import { createIntentSearch } from "@/shared/hooks/use-create-intent";

export const Route = createFileRoute("/_app/users/")({
  validateSearch: createIntentSearch,
  component: UsersPage,
});
