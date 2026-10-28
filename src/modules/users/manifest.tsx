// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import { MailIcon, UserPlusIcon, UsersIcon, UserXIcon } from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "users",
  nav: [
    {
      id: "directory.users",
      group: "directory",
      order: 20,
      title: "users:nav.directory.users.title",
      description: "users:nav.directory.users.description",
      url: "/users",
      icon: <UsersIcon />,
      capability: "user.read",
    },
    {
      id: "directory.allUsers",
      group: "directory",
      parent: "directory.users",
      order: 10,
      title: "users:nav.directory.allUsers.title",
      url: "/users",
      capability: "user.read",
    },
    {
      id: "directory.invitations",
      group: "directory",
      parent: "directory.users",
      order: 20,
      title: "users:nav.directory.invitations.title",
      url: "/invitations",
      capability: "user.read",
    },
    {
      id: "directory.deleted",
      group: "directory",
      parent: "directory.users",
      order: 40,
      title: "users:nav.directory.deleted.title",
      url: "/users/deleted",
      capability: "user.read",
    },
  ],
  commands: [
    {
      id: "cmd.create.user",
      text: "users:commands.createUser",
      icon: <UserPlusIcon />,
      to: "/users",
      capability: "user.write",
    },
    {
      id: "cmd.navigate.users",
      text: "users:commands.users",
      icon: <UsersIcon />,
      to: "/users",
      capability: "user.read",
    },
    {
      // Suspended is a filter on All users; this keeps it one search away.
      id: "cmd.navigate.suspended",
      text: "users:commands.suspended",
      icon: <UserXIcon />,
      to: "/users/suspended",
      capability: "user.read",
    },
    {
      id: "cmd.navigate.invitations",
      text: "users:commands.invitations",
      icon: <MailIcon />,
      to: "/invitations",
      capability: "user.write",
    },
  ],
  shortcuts: [
    {
      key: "u",
      description: "users:shortcuts.users",
      to: "/users",
    },
    {
      key: "i",
      description: "users:shortcuts.invitations",
      to: "/invitations",
    },
  ],
  extensions: {
    qeetaiSuggestions: {
      "/users": [
        {
          type: "tool",
          toolName: "search_users",
          label: "users:qeetaiSuggestions.labels.searchUsers",
          description: "users:qeetaiSuggestions.descriptions.searchUsers",
          requiredCapability: "user.read",
        },
        {
          type: "tool",
          toolName: "create_user",
          label: "users:qeetaiSuggestions.labels.createUser",
          requiredCapability: "user.write",
        },
        {
          type: "prompt",
          label: "users:qeetaiSuggestions.labels.suspendedUsers",
          text: "users:qeetaiSuggestions.prompts.suspendedUsers",
          requiredCapability: "user.read",
        },
        {
          type: "prompt",
          label: "users:qeetaiSuggestions.labels.userActivity",
          text: "users:qeetaiSuggestions.prompts.userActivity",
          requiredCapability: "audit.read",
        },
      ],
      "/users/$userId": [
        {
          type: "tool",
          toolName: "reset_user_mfa",
          label: "users:qeetaiSuggestions.labels.resetMfa",
          description: "users:qeetaiSuggestions.descriptions.resetMfa",
          requiredCapability: "user.write",
        },
        {
          type: "tool",
          toolName: "disable_user",
          label: "users:qeetaiSuggestions.labels.disableUser",
          requiredCapability: "user.write",
        },
        {
          type: "tool",
          toolName: "search_audit_logs",
          label: "users:qeetaiSuggestions.labels.userAuditEvents",
          description: "users:qeetaiSuggestions.descriptions.userAuditEvents",
          requiredCapability: "audit.read",
        },
        {
          type: "tool",
          toolName: "search_sessions",
          label: "users:qeetaiSuggestions.labels.activeSessions",
          requiredCapability: "user.read",
        },
        {
          type: "prompt",
          label: "users:qeetaiSuggestions.labels.userRecentActivity",
          text: "users:qeetaiSuggestions.prompts.userRecentActivity",
          requiredCapability: "audit.read",
        },
      ],
    },
  },
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    invitations: typeof import("./locales/en/invitations.json");
    users: typeof import("./locales/en/users.json");
  }
}
