import { createFileRoute } from "@tanstack/react-router";
import { ConnectionsPage } from "@/modules/directory/pages";

export const Route = createFileRoute("/_app/directory/connections")({ component: ConnectionsPage });
