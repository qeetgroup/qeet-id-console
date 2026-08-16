import { createFileRoute } from "@tanstack/react-router";

import { SectionOverview } from "@/modules/dashboard/components/section-overview";

export const Route = createFileRoute("/_app/authentication")({
  component: AuthenticationOverview,
});

function AuthenticationOverview() {
  return (
    <SectionOverview
      group="Authentication"
      overviewUrl="/authentication"
      description="How people prove who they are — sign-in methods, social providers, SSO, MFA and devices."
    />
  );
}
