import { createFileRoute } from "@tanstack/react-router";

import { SectionOverview } from "@/modules/dashboard/components/section-overview";

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsOverview,
});

function SettingsOverview() {
  return (
    <SectionOverview
      group="Settings"
      overviewUrl="/settings"
      description="Configure your organization — profile, domains, branding, security, billing and AI."
    />
  );
}
