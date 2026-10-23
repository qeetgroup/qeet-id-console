import { createFileRoute } from "@tanstack/react-router";

import { AnomaliesPage } from "@/modules/security/pages";

export const Route = createFileRoute("/_app/security/threats/anomalies")({
  component: AnomaliesPage,
});
