import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/modules/dashboard/pages";

export const Route = createFileRoute("/_app/")({ component: DashboardPage });
