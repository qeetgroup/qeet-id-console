import { createFileRoute } from "@tanstack/react-router";
import { SuspendedPage } from "@/modules/directory/components/suspended-page";

export const Route = createFileRoute("/_app/users/suspended")({ component: SuspendedPage });
