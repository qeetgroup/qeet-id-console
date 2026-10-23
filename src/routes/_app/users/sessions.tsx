import { createFileRoute } from "@tanstack/react-router";

import { UserSessionsPage } from "@/modules/users/pages";

export const Route = createFileRoute("/_app/users/sessions")({ component: UserSessionsPage });
