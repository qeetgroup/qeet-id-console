import { createFileRoute } from "@tanstack/react-router";

import { GdprPage } from "@/modules/compliance/pages";

// Rebuilt on @qeetrix/react: the page draws its own header.
export const Route = createFileRoute("/_app/security/compliance/gdpr")({
  staticData: { capability: "gdpr.write", pageHeader: true },
  component: GdprPage,
});
