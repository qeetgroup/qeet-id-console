import { createFileRoute } from "@tanstack/react-router";

import { RebacPage } from "@/modules/authorization/pages";

export const Route = createFileRoute("/_app/authorization/rebac")({
  component: RebacPage,
});
