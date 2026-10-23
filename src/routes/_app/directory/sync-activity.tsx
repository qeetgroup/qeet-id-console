import { createFileRoute } from "@tanstack/react-router";
import { SyncActivityPage } from "@/modules/directory/pages";

export const Route = createFileRoute("/_app/directory/sync-activity")({
  component: SyncActivityPage,
});
