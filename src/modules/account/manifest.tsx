// What this module adds to the console shell; see src/platform/modules/manifest.ts.

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "account",
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    account: typeof import("./locales/en/account.json");
  }
}
