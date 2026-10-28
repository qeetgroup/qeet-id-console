// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import { LockKeyholeIcon } from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "compliance",
  nav: [
    {
      id: "security.compliance",
      group: "security",
      order: 50,
      title: "compliance:nav.security.compliance.title",
      url: "/security/compliance/soc2",
      icon: <LockKeyholeIcon />,
      capability: "audit.read",
    },
    {
      id: "security.soc2",
      group: "security",
      parent: "security.compliance",
      order: 10,
      title: "compliance:nav.security.soc2.title",
      url: "/security/compliance/soc2",
      capability: "audit.read",
    },
    {
      id: "security.gdpr",
      group: "security",
      parent: "security.compliance",
      order: 30,
      title: "compliance:nav.security.gdpr.title",
      url: "/security/compliance/gdpr",
      capability: "gdpr.write",
    },
    {
      id: "security.iso27001",
      group: "security",
      parent: "security.compliance",
      order: 20,
      title: "compliance:nav.security.iso27001.title",
      url: "/security/compliance/iso27001",
      capability: "audit.read",
    },
    {
      id: "security.retention",
      group: "security",
      parent: "security.compliance",
      order: 40,
      title: "compliance:nav.security.retention.title",
      url: "/security/compliance/retention",
      capability: "policy.read",
    },
  ],
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    compliance: typeof import("./locales/en/compliance.json");
  }
}
