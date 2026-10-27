// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import { ChartColumnIcon, LayoutDashboardIcon } from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "dashboard",
  nav: [
    {
      id: "overview.dashboard",
      group: "overview",
      order: 10,
      title: "dashboard:nav.overview.dashboard.title",
      url: "/",
      icon: <LayoutDashboardIcon />,
    },
    {
      id: "overview.analytics",
      group: "overview",
      order: 30,
      title: "dashboard:nav.overview.analytics.title",
      url: "/analytics",
      icon: <ChartColumnIcon />,
      capability: "analytics.read",
    },
  ],
  commands: [
    {
      id: "cmd.navigate.dashboard",
      text: "dashboard:commands.dashboard",
      icon: <LayoutDashboardIcon className="size-4" />,
      to: "/",
    },
    {
      id: "cmd.navigate.analytics",
      text: "dashboard:commands.analytics",
      icon: <ChartColumnIcon className="size-4" />,
      to: "/analytics",
      capability: "analytics.read",
    },
  ],
  shortcuts: [
    {
      key: "d",
      description: "dashboard:shortcuts.dashboard",
      to: "/",
    },
  ],
  extensions: {
    qeetaiSuggestions: {
      // The Applications list (Applications › Overview is gone; the Dashboard is the one overview).
      "/auth/connections/oidc": [
        {
          type: "tool",
          toolName: "create_oauth_client",
          label: "dashboard:qeetaiSuggestions.labels.registerOAuthClient",
          requiredCapability: "connection.write",
        },
        {
          type: "tool",
          toolName: "generate_terraform",
          label: "dashboard:qeetaiSuggestions.labels.terraformClients",
          prefillInput: { resource_type: "oidc_client" },
          requiredCapability: "connection.read",
        },
        {
          type: "prompt",
          label: "dashboard:qeetaiSuggestions.labels.explainOAuth",
          text: "dashboard:qeetaiSuggestions.prompts.explainOAuth",
        },
      ],
    },
  },
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    dashboard: typeof import("./locales/en/dashboard.json");
  }
}
