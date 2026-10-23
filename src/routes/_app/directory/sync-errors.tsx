import { createFileRoute } from "@tanstack/react-router";
import { SyncErrorsPage } from "@/modules/directory";

export const Route = createFileRoute("/_app/directory/sync-errors")({ component: SyncErrorsPage });
