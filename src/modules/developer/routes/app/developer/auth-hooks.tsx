import { createFileRoute } from "@tanstack/react-router";

import { AuthHooksPage } from "@/modules/developer/pages";
import { createIntentSearch } from "@/shared/hooks/use-create-intent";

// Rebuilt on @qeetrix/react: the page draws its own header. The server reads auth hooks with
// policy.read (they gate sign-in), not connection.read.
export const Route = createFileRoute("/_app/developer/auth-hooks")({
  staticData: { capability: "policy.read", pageHeader: true },
  validateSearch: createIntentSearch,
  component: AuthHooksPage,
});
