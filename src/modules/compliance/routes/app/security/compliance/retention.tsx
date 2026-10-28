import { createFileRoute } from "@tanstack/react-router";

import { RetentionPage } from "@/modules/compliance/pages";

// Rebuilt on @qeetrix/react: the page draws its own header.
export const Route = createFileRoute("/_app/security/compliance/retention")({
  staticData: { capability: "policy.read", pageHeader: true },
  component: RetentionPage,
});
