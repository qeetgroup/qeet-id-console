import {
  ArchiveIcon,
  BadgeCheckIcon,
  BotIcon,
  BuildingComplexIcon,
  ChartColumnIcon,
  FileDownIcon,
  FingerprintPatternIcon,
  GaugeIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LogInIcon,
  MailIcon,
  PaletteIcon,
  RefreshCwIcon,
  Settings2Icon,
  ShieldCheckIcon,
  UserPlusIcon,
  UsersIcon,
  UsersRoundIcon,
  WebhookIcon,
  ZapIcon,
} from "@qeetrix/icons";
import type { ReactNode } from "react";

import type { Capability } from "@/platform/security/capability-model";

import type { SearchContext, SearchItem, SearchSource } from "./types/registry.types";

interface CommandDef {
  id: string;
  text: string; // catalogue prefix holding the title, subtitle and comma-separated keywords
  icon: ReactNode;
  capability?: Capability;
  run(ctx: SearchContext): void;
}

// Commands only navigate; the target screen runs the create or action flow itself.

const COMMANDS: CommandDef[] = [
  {
    id: "cmd.navigate.dashboard",
    text: "search:commands.dashboard",
    icon: <LayoutDashboardIcon className="size-4" />,
    run: ({ navigate }) => navigate("/"),
  },
  {
    id: "cmd.create.user",
    text: "search:commands.createUser",
    icon: <UserPlusIcon className="size-4" />,
    capability: "user.write",
    run: ({ navigate }) => navigate("/users"),
  },
  {
    id: "cmd.create.organization",
    text: "search:commands.createOrganization",
    icon: <BuildingComplexIcon className="size-4" />,
    run: ({ navigate }) => navigate("/organizations"),
  },
  {
    id: "cmd.create.role",
    text: "search:commands.createRole",
    icon: <ShieldCheckIcon className="size-4" />,
    capability: "role.write",
    run: ({ navigate }) => navigate("/authorization/roles"),
  },
  {
    id: "cmd.create.group",
    text: "search:commands.createGroup",
    icon: <UsersRoundIcon className="size-4" />,
    capability: "group.write",
    run: ({ navigate }) => navigate("/groups"),
  },
  {
    id: "cmd.navigate.users",
    text: "search:commands.users",
    icon: <UsersIcon className="size-4" />,
    capability: "user.read",
    run: ({ navigate }) => navigate("/users"),
  },
  {
    id: "cmd.navigate.invitations",
    text: "search:commands.invitations",
    icon: <MailIcon className="size-4" />,
    capability: "user.write",
    run: ({ navigate }) => navigate("/invitations"),
  },
  {
    id: "cmd.navigate.api-keys",
    text: "search:commands.apiKeys",
    icon: <KeyRoundIcon className="size-4" />,
    capability: "apikey.write",
    run: ({ navigate }) => navigate("/auth/api/keys"),
  },
  {
    id: "cmd.navigate.signing-keys",
    text: "search:commands.signingKeys",
    icon: <RefreshCwIcon className="size-4" />,
    capability: "connection.read",
    run: ({ navigate }) => navigate("/auth/api/signing-keys"),
  },
  {
    id: "cmd.navigate.oauth-clients",
    text: "search:commands.oauthClients",
    icon: <LogInIcon className="size-4" />,
    capability: "connection.write",
    run: ({ navigate }) => navigate("/auth/connections/oidc"),
  },
  {
    id: "cmd.navigate.passkeys",
    text: "search:commands.passkeys",
    icon: <FingerprintPatternIcon className="size-4" />,
    run: ({ navigate }) => navigate("/auth/login-methods/passkeys"),
  },
  {
    id: "cmd.navigate.mfa",
    text: "search:commands.mfa",
    icon: <ShieldCheckIcon className="size-4" />,
    run: ({ navigate }) => navigate("/auth/mfa/totp"),
  },
  {
    id: "cmd.navigate.audit-logs",
    text: "search:commands.auditLogs",
    icon: <ArchiveIcon className="size-4" />,
    capability: "audit.read",
    run: ({ navigate }) => navigate("/security/audit-logs"),
  },
  {
    id: "cmd.navigate.export-audit",
    text: "search:commands.exportAudit",
    icon: <FileDownIcon className="size-4" />,
    capability: "audit.read",
    run: ({ navigate }) => navigate("/security/audit-logs"),
  },
  {
    id: "cmd.navigate.webhooks",
    text: "search:commands.webhooks",
    icon: <WebhookIcon className="size-4" />,
    capability: "webhook.read",
    run: ({ navigate }) => navigate("/developer/webhooks"),
  },
  {
    id: "cmd.navigate.auth-hooks",
    text: "search:commands.authHooks",
    icon: <ZapIcon className="size-4" />,
    capability: "connection.read",
    run: ({ navigate }) => navigate("/developer/auth-hooks"),
  },
  {
    id: "cmd.navigate.agents",
    text: "search:commands.agents",
    icon: <BotIcon className="size-4" />,
    capability: "apikey.read",
    run: ({ navigate }) => navigate("/developer/agents"),
  },
  {
    id: "cmd.navigate.credentials",
    text: "search:commands.credentials",
    icon: <BadgeCheckIcon className="size-4" />,
    capability: "apikey.read",
    run: ({ navigate }) => navigate("/developer/credentials"),
  },
  {
    id: "cmd.navigate.analytics",
    text: "search:commands.analytics",
    icon: <ChartColumnIcon className="size-4" />,
    capability: "analytics.read",
    run: ({ navigate }) => navigate("/analytics"),
  },
  {
    id: "cmd.navigate.branding",
    text: "search:commands.branding",
    icon: <PaletteIcon className="size-4" />,
    capability: "branding.write",
    run: ({ navigate }) => navigate("/settings/branding"),
  },
  {
    id: "cmd.navigate.organization-settings",
    text: "search:commands.organizationSettings",
    icon: <Settings2Icon className="size-4" />,
    capability: "tenant.read",
    run: ({ navigate }) => navigate("/settings/organization/general"),
  },
  {
    id: "cmd.navigate.policy-builder",
    text: "search:commands.policyBuilder",
    icon: <GaugeIcon className="size-4" />,
    capability: "policy.write",
    run: ({ navigate }) => navigate("/authorization/builder"),
  },
];

export function createCommandSource(): SearchSource {
  return {
    id: "commands",
    getItems(_query: string, ctx: SearchContext): SearchItem[] {
      return COMMANDS.filter(
        (def) => def.capability === undefined || ctx.capabilities.has(def.capability),
      ).map(
        (def): SearchItem => ({
          id: def.id,
          kind: "command",
          category: ctx.t("search:category.commands"),
          title: ctx.t(`${def.text}.title`),
          subtitle: ctx.t(`${def.text}.subtitle`),
          icon: def.icon,
          // Translated, so people can search in their own language.
          keywords: ctx
            .t(`${def.text}.keywords`)
            .split(",")
            .map((word) => word.trim()),
          capability: def.capability,
          run: def.run,
        }),
      );
    },
  };
}
