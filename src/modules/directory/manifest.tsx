// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import { NetworkIcon, ServerIcon, WorkflowIcon } from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "directory",
  nav: [
    {
      id: "directory.directories",
      group: "directory",
      order: 50,
      title: "directory:nav.directory.directories.title",
      description: "directory:nav.directory.directories.description",
      url: "/directory/connections",
      icon: <NetworkIcon />,
      capability: "connection.read",
    },
    {
      id: "directory.connections",
      group: "directory",
      parent: "directory.directories",
      order: 10,
      title: "directory:nav.directory.connections.title",
      url: "/directory/connections",
      capability: "connection.read",
    },
    {
      id: "directory.syncActivity",
      group: "directory",
      parent: "directory.directories",
      order: 40,
      title: "directory:nav.directory.syncActivity.title",
      url: "/directory/sync-activity",
      capability: "connection.read",
    },
    {
      id: "directory.syncErrors",
      group: "directory",
      parent: "directory.directories",
      order: 50,
      title: "directory:nav.directory.syncErrors.title",
      url: "/directory/sync-errors",
      capability: "connection.read",
    },
    {
      id: "directory.mappings",
      group: "directory",
      parent: "directory.directories",
      order: 60,
      title: "directory:nav.directory.mappings.title",
      url: "/directory/attribute-mappings",
      capability: "connection.read",
    },
  ],
  // SCIM and LDAP are connections, not tabs: these keep them a search away.
  commands: [
    {
      id: "cmd.directory.scim",
      text: "directory:commands.scim",
      icon: <WorkflowIcon className="size-4" />,
      to: "/directory/connections/scim",
      capability: "connection.read",
    },
    {
      id: "cmd.directory.ldap",
      text: "directory:commands.ldap",
      icon: <ServerIcon className="size-4" />,
      to: "/directory/connections/ldap",
      capability: "connection.read",
    },
  ],
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    directory: typeof import("./locales/en/directory.json");
  }
}
