import { createFileRoute } from "@tanstack/react-router";

import { RateLimitsPage } from "@/modules/security/pages";

export const Route = createFileRoute("/_app/security/threats/rate-limits")({
  staticData: { capability: "policy.read" },
  component: RateLimitsPage,
});
