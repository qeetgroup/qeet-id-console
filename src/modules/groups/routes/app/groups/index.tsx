import { createFileRoute } from "@tanstack/react-router";

import { GroupsPage } from "@/modules/groups/pages";
import { createIntentSearch } from "@/shared/hooks/use-create-intent";

export const Route = createFileRoute("/_app/groups/")({
  staticData: { capability: "group.read" },
  validateSearch: createIntentSearch,
  component: GroupsPage,
});
