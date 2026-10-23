import { createFileRoute } from "@tanstack/react-router";

import { ApiKeysPage } from "@/modules/developer/pages";
import { createIntentSearch } from "@/shared/hooks/use-create-intent";

export const Route = createFileRoute("/_app/auth/api/keys")({
  staticData: { capability: "apikey.read" },
  validateSearch: createIntentSearch,
  component: ApiKeysPage,
});
