import { createFileRoute } from "@tanstack/react-router";

import { OrgsPage } from "@/modules/organizations/pages";

export const Route = createFileRoute("/_app/organizations/")({ component: OrgsPage });
