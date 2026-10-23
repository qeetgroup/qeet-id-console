import { createFileRoute } from "@tanstack/react-router";

import { DefaultRateLimitsPage } from "@/modules/security/pages";

export const Route = createFileRoute("/_app/security/rate-limits")({
  component: DefaultRateLimitsPage,
});
