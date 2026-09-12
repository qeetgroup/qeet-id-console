import { createFileRoute } from "@tanstack/react-router";
import { SyncActivityPage } from "@/modules/directory/components/sync-activity-page";

export const Route = createFileRoute("/_app/directory/sync-activity")({
  component: SyncActivityPage,
});
