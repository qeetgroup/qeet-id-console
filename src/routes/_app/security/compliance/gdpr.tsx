import { createFileRoute } from "@tanstack/react-router";

import { GdprPage } from "@/modules/compliance/pages";

export const Route = createFileRoute("/_app/security/compliance/gdpr")({
  component: GdprPage,
});
