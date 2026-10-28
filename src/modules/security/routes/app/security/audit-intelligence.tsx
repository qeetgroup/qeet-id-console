import { createFileRoute, redirect } from "@tanstack/react-router";

// Audit intelligence is now the audit log's Flagged view (redesign-findings, Security overview);
// an old link or bookmark lands there.
export const Route = createFileRoute("/_app/security/audit-intelligence")({
  staticData: { capability: "audit.read" },
  beforeLoad: () => {
    throw redirect({ to: "/security/audit-logs", search: { view: "flagged" }, replace: true });
  },
});
