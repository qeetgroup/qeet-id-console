import { createFileRoute } from "@tanstack/react-router";

import { NotFoundPage } from "@/modules/dashboard/pages";

// Any address inside the console that no route matches.
export const Route = createFileRoute("/_app/$")({
  component: NotFoundPage,
});
