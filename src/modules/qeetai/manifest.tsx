// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import { SparklesIcon } from "@qeetrix/icons";

import { env } from "@/platform/config/env";
import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "qeetai",
  flags: [
    {
      id: "qeetai",
      owner: "Qeet ID console",
      expires: null,
      description:
        "Kill switch for the assistant: off in air-gapped builds (VITE_QEETAI_ENABLED=false) and for any deployment without an AI provider.",
      enabled: env.VITE_QEETAI_ENABLED !== "false",
    },
  ],
  nav: [
    {
      id: "settings.qeetAi",
      group: "settings",
      order: 80,
      title: "qeetai:nav.settings.qeetAi.title",
      description: "qeetai:nav.settings.qeetAi.description",
      url: "/settings/qeet-ai",
      icon: <SparklesIcon />,
      capability: "secret.read",
    },
  ],
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    qeetai: typeof import("./locales/en/qeetai.json");
  }
}
