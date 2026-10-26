// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import { UserRoundIcon } from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "account",
  nav: [
    {
      // One entry, for everyone: the person's own pages are listed inside it.
      id: "account.my-account",
      group: "account",
      order: 10,
      title: "account:nav.myAccount",
      description: "account:area.description",
      url: "/account",
      icon: <UserRoundIcon />,
    },
  ],
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    account: typeof import("./locales/en/account.json");
  }
}
