// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import { CreditCardIcon } from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "billing",
  nav: [
    {
      id: "settings.billing",
      group: "settings",
      order: 70,
      title: "billing:nav.settings.billing.title",
      description: "billing:nav.settings.billing.description",
      url: "/settings/billing",
      icon: <CreditCardIcon />,
      capability: "billing.read",
    },
  ],
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    billing: typeof import("./locales/en/billing.json");
  }
}
