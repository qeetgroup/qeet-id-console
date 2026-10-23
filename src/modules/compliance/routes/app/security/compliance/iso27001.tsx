import { createFileRoute } from "@tanstack/react-router";

import { ComplianceEvidencePage } from "@/modules/compliance/pages";

export const Route = createFileRoute("/_app/security/compliance/iso27001")({
  staticData: { capability: "audit.read" },
  component: Iso27001Page,
});

function Iso27001Page() {
  return <ComplianceEvidencePage framework="iso27001" />;
}
