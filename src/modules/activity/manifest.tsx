// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import { ActivityIcon } from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "activity",
  nav: [
    {
      id: "overview.activity",
      group: "overview",
      order: 20,
      title: "activity:nav.overview.activity.title",
      url: "/activity",
      icon: <ActivityIcon />,
      capability: "audit.read",
    },
  ],
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    activity: typeof import("./locales/en/activity.json");
  }
}
