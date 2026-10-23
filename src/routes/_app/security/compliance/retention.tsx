import { createFileRoute } from "@tanstack/react-router";

import { RetentionPage } from "@/modules/compliance/pages";

export const Route = createFileRoute("/_app/security/compliance/retention")({
  component: RetentionPage,
});
