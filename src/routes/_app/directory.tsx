import { createFileRoute } from "@tanstack/react-router";

import { SectionOverview } from "@/modules/dashboard/components/section-overview";

export const Route = createFileRoute("/_app/directory")({
  component: DirectoryOverview,
});

function DirectoryOverview() {
  return (
    <SectionOverview
      group="Directory"
      overviewUrl="/directory"
      description="Everyone and everything in your organization — users, organizations, groups and directory-sync connections."
    />
  );
}
