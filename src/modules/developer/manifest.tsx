// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import {
  BadgeCheckIcon,
  BotIcon,
  FileKeyIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  RefreshCwIcon,
  ServerCogIcon,
  WebhookIcon,
  ZapIcon,
} from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "developer",
  nav: [
    // Machine access: every credential that calls Qeet ID without a person signing in, as one
    // item with a tab per kind (its All tab is the item's own page).
    {
      id: "developer.machineAccess",
      group: "developer",
      order: 20,
      title: "developer:nav.developer.machineAccess.title",
      description: "developer:nav.developer.machineAccess.description",
      url: "/developer/machine-access",
      icon: <KeyRoundIcon />,
      capability: "apikey.read",
    },
    {
      id: "developer.machineAccess.all",
      group: "developer",
      parent: "developer.machineAccess",
      order: 10,
      title: "developer:nav.developer.machineAccess.all",
      url: "/developer/machine-access",
      capability: "apikey.read",
    },
    {
      id: "developer.machineAccess.apiKeys",
      group: "developer",
      parent: "developer.machineAccess",
      order: 20,
      title: "developer:nav.developer.machineAccess.apiKeys",
      url: "/auth/api/keys",
      capability: "apikey.read",
    },
    {
      id: "developer.machineAccess.machineIdentities",
      group: "developer",
      parent: "developer.machineAccess",
      order: 30,
      title: "developer:nav.developer.machineAccess.machineIdentities",
      url: "/auth/api/machine-identities",
      capability: "apikey.read",
    },
    {
      id: "developer.machineAccess.agents",
      group: "developer",
      parent: "developer.machineAccess",
      order: 40,
      title: "developer:nav.developer.machineAccess.agents",
      url: "/developer/agents",
      capability: "apikey.read",
    },
    {
      id: "developer.signingKeys",
      group: "developer",
      order: 40,
      title: "developer:nav.developer.signingKeys.title",
      description: "developer:nav.developer.signingKeys.description",
      url: "/auth/api/signing-keys",
      icon: <FileKeyIcon />,
      capability: "connection.read",
    },
    {
      id: "developer.secrets",
      group: "developer",
      order: 50,
      title: "developer:nav.developer.secrets.title",
      description: "developer:nav.developer.secrets.description",
      url: "/auth/api/secrets",
      icon: <LockKeyholeIcon />,
      capability: "secret.read",
    },
    {
      id: "developer.webhooks",
      group: "developer",
      order: 60,
      title: "developer:nav.developer.webhooks.title",
      description: "developer:nav.developer.webhooks.description",
      url: "/developer/webhooks",
      icon: <WebhookIcon />,
      capability: "webhook.read",
    },
    {
      // The server reads auth hooks with policy.read: they gate sign-in.
      id: "developer.authHooks",
      group: "developer",
      order: 70,
      title: "developer:nav.developer.authHooks.title",
      description: "developer:nav.developer.authHooks.description",
      url: "/developer/auth-hooks",
      icon: <ZapIcon />,
      capability: "policy.read",
    },
    {
      // The server reads credentials with secret.read.
      id: "developer.credentials",
      group: "developer",
      order: 90,
      title: "developer:nav.developer.credentials.title",
      description: "developer:nav.developer.credentials.description",
      url: "/developer/credentials",
      icon: <BadgeCheckIcon />,
      capability: "secret.read",
    },
    // Bots are off the sidebar until the server has automations (/developer/bots says so).
    {
      id: "developer.infrastructure",
      group: "developer",
      order: 110,
      title: "developer:nav.developer.infrastructure.title",
      description: "developer:nav.developer.infrastructure.description",
      url: "/developer/infrastructure",
      icon: <ServerCogIcon />,
      capability: "audit.read",
    },
  ],
  commands: [
    {
      id: "cmd.navigate.machine-access",
      text: "developer:commands.machineAccess",
      icon: <KeyRoundIcon />,
      to: "/developer/machine-access",
      capability: "apikey.read",
    },
    {
      id: "cmd.navigate.api-keys",
      text: "developer:commands.apiKeys",
      icon: <KeyRoundIcon />,
      to: "/auth/api/keys",
      capability: "apikey.write",
    },
    {
      id: "cmd.navigate.signing-keys",
      text: "developer:commands.signingKeys",
      icon: <RefreshCwIcon />,
      to: "/auth/api/signing-keys",
      capability: "connection.read",
    },
    {
      id: "cmd.navigate.webhooks",
      text: "developer:commands.webhooks",
      icon: <WebhookIcon />,
      to: "/developer/webhooks",
      capability: "webhook.read",
    },
    {
      id: "cmd.navigate.auth-hooks",
      text: "developer:commands.authHooks",
      icon: <ZapIcon />,
      to: "/developer/auth-hooks",
      capability: "policy.read",
    },
    {
      id: "cmd.navigate.agents",
      text: "developer:commands.agents",
      icon: <BotIcon />,
      to: "/developer/agents",
      capability: "apikey.read",
    },
    {
      id: "cmd.navigate.credentials",
      text: "developer:commands.credentials",
      icon: <BadgeCheckIcon />,
      to: "/developer/credentials",
      capability: "secret.read",
    },
  ],
  shortcuts: [
    {
      key: "w",
      description: "developer:shortcuts.webhooks",
      to: "/developer/webhooks",
    },
  ],
  extensions: {
    qeetaiSuggestions: {
      "/developer/*": [
        {
          type: "tool",
          toolName: "generate_sdk_snippet",
          label: "developer:qeetaiSuggestions.labels.codeSnippet",
          prefillInput: { language: "typescript", endpoint: "/v1/users" },
        },
        {
          type: "tool",
          toolName: "generate_api_example",
          label: "developer:qeetaiSuggestions.labels.apiExample",
          prefillInput: { endpoint: "/v1/users", method: "GET" },
        },
      ],
    },
  },
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    developer: typeof import("./locales/en/developer.json");
  }
}
