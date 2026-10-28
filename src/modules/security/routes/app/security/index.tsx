import { createFileRoute, redirect } from "@tanstack/react-router";

// The Dashboard is the console's one overview; this area opens on Threats, which opens on
// Anomalies (redesign-findings, Threat protection), and an old link to its overview lands there.
export const Route = createFileRoute("/_app/security/")({
  beforeLoad: () => {
    throw redirect({ to: "/security/threats/anomalies", replace: true });
  },
});
