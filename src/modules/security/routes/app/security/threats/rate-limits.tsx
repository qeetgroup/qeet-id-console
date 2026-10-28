import { createFileRoute, redirect } from "@tanstack/react-router";

// Rate limits is one page now, under Security (redesign-findings, Threat protection); an old link
// or bookmark to Threats' copy lands there.
export const Route = createFileRoute("/_app/security/threats/rate-limits")({
  staticData: { capability: "policy.read" },
  beforeLoad: () => {
    throw redirect({ to: "/security/rate-limits", replace: true });
  },
});
