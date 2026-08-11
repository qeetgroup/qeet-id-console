import { createFileRoute } from "@tanstack/react-router";

import { SectionOverview } from "@/features/dashboard/components/section-overview";

export const Route = createFileRoute("/_app/applications")({
  component: ApplicationsOverview,
});

function ApplicationsOverview() {
  return (
    <SectionOverview
      group="Applications"
      overviewUrl="/applications"
      description="Apps and machine identities that authenticate with Qeet ID, and the consents they hold."
    />
  );
}
