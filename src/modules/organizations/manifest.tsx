// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import {
  BuildingComplexIcon,
  GlobeIcon,
  MailIcon,
  Settings2Icon,
  ShieldCheckIcon,
} from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "organizations",
  nav: [
    {
      id: "directory.organizations",
      group: "directory",
      order: 40,
      title: "organizations:nav.directory.organizations.title",
      description: "organizations:nav.directory.organizations.description",
      url: "/organizations",
      icon: <BuildingComplexIcon />,
    },
    {
      id: "settings.general",
      group: "settings",
      order: 20,
      title: "organizations:nav.settings.general.title",
      description: "organizations:nav.settings.general.description",
      url: "/settings/organization/general",
      icon: <Settings2Icon />,
      capability: "tenant.read",
    },
    {
      id: "settings.domains",
      group: "settings",
      order: 30,
      title: "organizations:nav.settings.domains.title",
      description: "organizations:nav.settings.domains.description",
      url: "/settings/organization/domains",
      icon: <GlobeIcon />,
      capability: "tenant.read",
    },
    {
      id: "settings.emails",
      group: "settings",
      order: 50,
      title: "organizations:nav.settings.emails.title",
      description: "organizations:nav.settings.emails.description",
      url: "/settings/organization/email-templates",
      icon: <MailIcon />,
      capability: "branding.write",
    },
    {
      id: "settings.security",
      group: "settings",
      order: 60,
      title: "organizations:nav.settings.security.title",
      description: "organizations:nav.settings.security.description",
      url: "/settings/organization/security-policy",
      icon: <ShieldCheckIcon />,
      capability: "policy.read",
    },
  ],
  commands: [
    {
      id: "cmd.create.organization",
      text: "organizations:commands.createOrganization",
      icon: <BuildingComplexIcon className="size-4" />,
      to: "/create-organization",
    },
    {
      id: "cmd.navigate.organization-settings",
      text: "organizations:commands.organizationSettings",
      icon: <Settings2Icon className="size-4" />,
      to: "/settings/organization/general",
      capability: "tenant.read",
    },
  ],
  shortcuts: [
    {
      key: "t",
      description: "organizations:shortcuts.organizations",
      to: "/organizations",
    },
    {
      key: "s",
      description: "organizations:shortcuts.organizationSettings",
      to: "/settings/organization/general",
    },
  ],
  extensions: {
    qeetaiSuggestions: {
      "/settings/*": [
        {
          type: "tool",
          toolName: "set_strict_mfa",
          label: "organizations:qeetaiSuggestions.labels.configureStrictMfa",
          requiredCapability: "policy.write",
        },
        {
          type: "prompt",
          label: "organizations:qeetaiSuggestions.labels.explainSecurity",
          text: "organizations:qeetaiSuggestions.prompts.explainSecurity",
          requiredCapability: "policy.read",
        },
      ],
      "/organizations": [
        {
          type: "tool",
          toolName: "create_organization",
          label: "organizations:qeetaiSuggestions.labels.createOrganization",
          requiredCapability: "tenant.write",
        },
        {
          type: "tool",
          toolName: "generate_terraform",
          label: "organizations:qeetaiSuggestions.labels.terraformTenant",
          prefillInput: { resource_type: "tenant" },
          requiredCapability: "connection.read",
        },
      ],
    },
  },
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    organizations: typeof import("./locales/en/organizations.json");
  }
}
