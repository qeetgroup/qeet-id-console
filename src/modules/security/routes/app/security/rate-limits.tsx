import { createFileRoute } from "@tanstack/react-router";

import { RateLimitsPage } from "@/modules/security/pages";

// Rebuilt on @qeetrix/react: the one Rate limits page (Threats' old one redirects here). Its
// header is its own.
export const Route = createFileRoute("/_app/security/rate-limits")({
  staticData: { capability: "policy.read" },
  component: RateLimitsPage,
});
