import { createFileRoute } from "@tanstack/react-router";

import { ApplicationsOverview } from "@/modules/dashboard/components/applications-overview";

export const Route = createFileRoute("/_app/applications")({
  component: ApplicationsOverviewPage,
});

function ApplicationsOverviewPage() {
  return (
    <ApplicationsOverview description="Manage client applications, machine identities, API keys, permissions, and OAuth consent across your organization." />
  );
}
