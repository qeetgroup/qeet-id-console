// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import { PaletteIcon } from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "branding",
  nav: [
    {
      id: "settings.branding",
      group: "settings",
      order: 40,
      title: "branding:nav.settings.branding.title",
      description: "branding:nav.settings.branding.description",
      url: "/settings/branding",
      icon: <PaletteIcon />,
      capability: "branding.write",
    },
  ],
  commands: [
    {
      id: "cmd.navigate.branding",
      text: "branding:commands.branding",
      icon: <PaletteIcon className="size-4" />,
      to: "/settings/branding",
      capability: "branding.write",
    },
  ],
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    branding: typeof import("./locales/en/branding.json");
  }
}
