// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import {
  BlocksIcon,
  BoxesIcon,
  FlaskConicalIcon,
  GaugeIcon,
  KeyRoundIcon,
  Settings2Icon,
  ShapesIcon,
  ShieldCheckIcon,
} from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "authorization",
  nav: [
    {
      id: "authorization.roles",
      group: "authorization",
      order: 20,
      title: "authorization:nav.authorization.roles.title",
      url: "/authorization/roles",
      icon: <ShieldCheckIcon />,
      capability: "role.read",
    },
    {
      id: "authorization.permissions",
      group: "authorization",
      order: 30,
      title: "authorization:nav.authorization.permissions.title",
      url: "/authorization/permissions",
      icon: <KeyRoundIcon />,
      capability: "role.read",
    },
    {
      id: "authorization.resources",
      group: "authorization",
      order: 40,
      title: "authorization:nav.authorization.resources.title",
      url: "/authorization/resources",
      icon: <ShapesIcon />,
      capability: "role.read",
    },
    {
      id: "authorization.models",
      group: "authorization",
      order: 50,
      title: "authorization:nav.authorization.models.title",
      url: "/authorization/rbac",
      icon: <BoxesIcon />,
      capability: "role.read",
    },
    {
      id: "authorization.rbac",
      group: "authorization",
      parent: "authorization.models",
      order: 10,
      title: "authorization:nav.authorization.rbac.title",
      url: "/authorization/rbac",
      capability: "role.read",
    },
    {
      id: "authorization.abac",
      group: "authorization",
      parent: "authorization.models",
      order: 20,
      title: "authorization:nav.authorization.abac.title",
      url: "/authorization/abac",
      capability: "policy.read",
    },
    {
      id: "authorization.rebac",
      group: "authorization",
      parent: "authorization.models",
      order: 30,
      title: "authorization:nav.authorization.rebac.title",
      url: "/authorization/rebac",
      capability: "role.read",
    },
    {
      id: "authorization.policies",
      group: "authorization",
      order: 60,
      title: "authorization:nav.authorization.policies.title",
      url: "/authorization/builder",
      icon: <BlocksIcon />,
      capability: "policy.read",
    },
    {
      id: "authorization.builder",
      group: "authorization",
      parent: "authorization.policies",
      order: 10,
      title: "authorization:nav.authorization.builder.title",
      url: "/authorization/builder",
      capability: "policy.read",
    },
    {
      id: "authorization.templates",
      group: "authorization",
      parent: "authorization.policies",
      order: 20,
      title: "authorization:nav.authorization.templates.title",
      url: "/authorization/templates",
      capability: "policy.read",
    },
    {
      id: "authorization.versions",
      group: "authorization",
      parent: "authorization.policies",
      order: 30,
      title: "authorization:nav.authorization.versions.title",
      url: "/authorization/versions",
      capability: "policy.read",
    },
    {
      id: "authorization.testing",
      group: "authorization",
      order: 70,
      title: "authorization:nav.authorization.testing.title",
      url: "/authorization/simulator",
      icon: <FlaskConicalIcon />,
      capability: "role.read",
    },
    {
      id: "authorization.simulator",
      group: "authorization",
      parent: "authorization.testing",
      order: 10,
      title: "authorization:nav.authorization.simulator.title",
      url: "/authorization/simulator",
      capability: "role.read",
    },
    {
      id: "authorization.explorer",
      group: "authorization",
      parent: "authorization.testing",
      order: 20,
      title: "authorization:nav.authorization.explorer.title",
      url: "/authorization/explorer",
      capability: "role.read",
    },
    {
      id: "authorization.accessTester",
      group: "authorization",
      parent: "authorization.testing",
      order: 30,
      title: "authorization:nav.authorization.accessTester.title",
      url: "/authorization/access-tester",
      capability: "role.read",
    },
    {
      id: "authorization.settings",
      group: "authorization",
      order: 80,
      title: "authorization:nav.authorization.settings.title",
      url: "/authorization/settings",
      icon: <Settings2Icon />,
      capability: "role.read",
    },
  ],
  commands: [
    {
      id: "cmd.create.role",
      text: "authorization:commands.createRole",
      icon: <ShieldCheckIcon className="size-4" />,
      to: "/authorization/roles",
      capability: "role.write",
    },
    {
      id: "cmd.navigate.policy-builder",
      text: "authorization:commands.policyBuilder",
      icon: <GaugeIcon className="size-4" />,
      to: "/authorization/builder",
      capability: "policy.write",
    },
  ],
  shortcuts: [
    {
      key: "r",
      description: "authorization:shortcuts.rolesPermissions",
      to: "/authorization/roles",
    },
  ],
  extensions: {
    qeetaiSuggestions: {
      "/authorization/roles": [
        {
          type: "tool",
          toolName: "create_role",
          label: "authorization:qeetaiSuggestions.labels.createRole",
          requiredCapability: "role.write",
        },
        {
          type: "tool",
          toolName: "grant_permission",
          label: "authorization:qeetaiSuggestions.labels.grantPermission",
          requiredCapability: "role.write",
        },
        {
          type: "tool",
          toolName: "simulate_authorization",
          label: "authorization:qeetaiSuggestions.labels.simulateAuthorization",
          description: "authorization:qeetaiSuggestions.descriptions.simulateAccess",
          requiredCapability: "role.read",
        },
        {
          type: "prompt",
          label: "authorization:qeetaiSuggestions.labels.explainRoles",
          text: "authorization:qeetaiSuggestions.prompts.explainRoles",
          requiredCapability: "role.read",
        },
      ],
      "/authorization/abac": [
        {
          type: "tool",
          toolName: "simulate_authorization",
          label: "authorization:qeetaiSuggestions.labels.simulateAuthorization",
          description: "authorization:qeetaiSuggestions.descriptions.simulateDecision",
          requiredCapability: "policy.read",
        },
        {
          type: "prompt",
          label: "authorization:qeetaiSuggestions.labels.summarizePolicies",
          text: "authorization:qeetaiSuggestions.prompts.summarizePolicies",
          requiredCapability: "policy.read",
        },
      ],
      "/authorization/*": [
        {
          type: "tool",
          toolName: "simulate_authorization",
          label: "authorization:qeetaiSuggestions.labels.simulateAuthorization",
          requiredCapability: "role.read",
        },
        {
          type: "tool",
          toolName: "generate_terraform",
          label: "authorization:qeetaiSuggestions.labels.terraformRoles",
          prefillInput: { resource_type: "role" },
          requiredCapability: "connection.read",
        },
      ],
    },
  },
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    authorization: typeof import("./locales/en/authorization.json");
  }
}
