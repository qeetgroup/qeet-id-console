import { createFileRoute } from "@tanstack/react-router";

import { DirectoryOverview } from "@/modules/dashboard/pages";

export const Route = createFileRoute("/_app/directory/")({ component: DirectoryOverview });
