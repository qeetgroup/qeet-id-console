import { createFileRoute } from "@tanstack/react-router";
import { SyncErrorsPage } from "@/modules/directory/components/sync-errors-page";

export const Route = createFileRoute("/_app/directory/sync-errors")({ component: SyncErrorsPage });
