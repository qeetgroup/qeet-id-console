import { createFileRoute } from "@tanstack/react-router";

import { SettingsOverview } from "@/modules/dashboard";

export const Route = createFileRoute("/_app/settings/")({
  component: SettingsOverviewPage,
});

function SettingsOverviewPage() {
  return (
    <SettingsOverview description="Configure your organization — profile, domains, branding, security, billing and AI." />
  );
}
