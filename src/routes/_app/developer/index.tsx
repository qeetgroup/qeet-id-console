import { createFileRoute } from "@tanstack/react-router";

import { SectionOverview } from "@/features/dashboard/components/section-overview";

export const Route = createFileRoute("/_app/developer/")({
  component: DeveloperOverview,
});

function DeveloperOverview() {
  return (
    <SectionOverview
      group="Developer"
      overviewUrl="/developer"
      description="Keys, tokens, webhooks and the building blocks for integrating with Qeet ID."
    />
  );
}
