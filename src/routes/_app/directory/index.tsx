import { createFileRoute } from "@tanstack/react-router";
import { DirectoryOverview } from "@/modules/dashboard/components/directory-overview";

export const Route = createFileRoute("/_app/directory/")({ component: DirectoryOverview });
