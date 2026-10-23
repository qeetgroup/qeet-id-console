// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import {
  BadgeCheckIcon,
  BotIcon,
  CpuIcon,
  FileKeyIcon,
  GaugeIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  RefreshCwIcon,
  ServerCogIcon,
  SparklesIcon,
  WebhookIcon,
  ZapIcon,
} from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "developer",
  nav: [
    {
      id: "applications.machineApps",
      group: "applications",
      order: 30,
      title: "developer:nav.applications.machineApps.title",
      description: "developer:nav.applications.machineApps.description",
      url: "/auth/api/machine-identities",
      icon: <CpuIcon />,
      capability: "apikey.read",
    },
    {
      id: "developer.overview",
      group: "developer",
      order: 10,
      title: "developer:nav.developer.overview.title",
      url: "/developer",
      icon: <GaugeIcon />,
    },
    {
      id: "developer.apiKeys",
      group: "developer",
      order: 20,
      title: "developer:nav.developer.apiKeys.title",
      description: "developer:nav.developer.apiKeys.description",
      url: "/auth/api/keys",
      icon: <KeyRoundIcon />,
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
      id: "developer.authHooks",
      group: "developer",
      order: 70,
      title: "developer:nav.developer.authHooks.title",
      description: "developer:nav.developer.authHooks.description",
      url: "/developer/auth-hooks",
      icon: <ZapIcon />,
      capability: "connection.read",
    },
    {
      id: "developer.agents",
      group: "developer",
      order: 80,
      title: "developer:nav.developer.agents.title",
      description: "developer:nav.developer.agents.description",
      url: "/developer/agents",
      icon: <SparklesIcon />,
      capability: "apikey.read",
    },
    {
      id: "developer.credentials",
      group: "developer",
      order: 90,
      title: "developer:nav.developer.credentials.title",
      description: "developer:nav.developer.credentials.description",
      url: "/developer/credentials",
      icon: <BadgeCheckIcon />,
      capability: "apikey.read",
    },
    {
      id: "developer.bots",
      group: "developer",
      order: 100,
      title: "developer:nav.developer.bots.title",
      description: "developer:nav.developer.bots.description",
      url: "/developer/bots",
      icon: <BotIcon />,
      capability: "apikey.read",
    },
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
      id: "cmd.navigate.api-keys",
      text: "developer:commands.apiKeys",
      icon: <KeyRoundIcon className="size-4" />,
      to: "/auth/api/keys",
      capability: "apikey.write",
    },
    {
      id: "cmd.navigate.signing-keys",
      text: "developer:commands.signingKeys",
      icon: <RefreshCwIcon className="size-4" />,
      to: "/auth/api/signing-keys",
      capability: "connection.read",
    },
    {
      id: "cmd.navigate.webhooks",
      text: "developer:commands.webhooks",
      icon: <WebhookIcon className="size-4" />,
      to: "/developer/webhooks",
      capability: "webhook.read",
    },
    {
      id: "cmd.navigate.auth-hooks",
      text: "developer:commands.authHooks",
      icon: <ZapIcon className="size-4" />,
      to: "/developer/auth-hooks",
      capability: "connection.read",
    },
    {
      id: "cmd.navigate.agents",
      text: "developer:commands.agents",
      icon: <BotIcon className="size-4" />,
      to: "/developer/agents",
      capability: "apikey.read",
    },
    {
      id: "cmd.navigate.credentials",
      text: "developer:commands.credentials",
      icon: <BadgeCheckIcon className="size-4" />,
      to: "/developer/credentials",
      capability: "apikey.read",
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
      "/auth/api/signing-keys": [
        {
          type: "tool",
          toolName: "rotate_signing_keys",
          label: "developer:qeetaiSuggestions.labels.rotateSigningKeys",
          requiredCapability: "connection.write",
        },
      ],
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
    "signing-keys": typeof import("./locales/en/signing-keys.json");
  }
}
