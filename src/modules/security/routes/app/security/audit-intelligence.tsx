import { createFileRoute } from "@tanstack/react-router";

import { AuditIntelligencePage } from "@/modules/security/pages";

export const Route = createFileRoute("/_app/security/audit-intelligence")({
  staticData: { capability: "audit.read" },
  component: AuditIntelligencePage,
});
