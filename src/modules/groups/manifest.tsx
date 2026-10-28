// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import { UsersRoundIcon } from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "groups",
  nav: [
    {
      id: "directory.groups",
      group: "directory",
      order: 30,
      title: "groups:nav.directory.groups.title",
      description: "groups:nav.directory.groups.description",
      url: "/groups",
      icon: <UsersRoundIcon />,
      capability: "group.read",
    },
  ],
  commands: [
    {
      id: "cmd.create.group",
      text: "groups:commands.createGroup",
      icon: <UsersRoundIcon />,
      to: "/groups",
      capability: "group.write",
    },
  ],
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    groups: typeof import("./locales/en/groups.json");
  }
}
