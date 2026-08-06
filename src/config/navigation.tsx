import {
  ActivityIcon,
  AppWindowIcon,
  BadgeCheckIcon,
  BlocksIcon,
  BotIcon,
  BoxesIcon,
  Building2Icon,
  ChartColumnIcon,
  CpuIcon,
  CreditCardIcon,
  FileKey2Icon,
  FingerprintIcon,
  FlaskConicalIcon,
  GaugeIcon,
  GlobeIcon,
  HandshakeIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LockKeyholeIcon,
  LogInIcon,
  MailIcon,
  MonitorSmartphoneIcon,
  NetworkIcon,
  PaletteIcon,
  ScrollTextIcon,
  ServerCogIcon,
  Settings2Icon,
  ShapesIcon,
  Share2Icon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TicketIcon,
  UsersIcon,
  UsersRoundIcon,
  WebhookIcon,
  WorkflowIcon,
  ZapIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { Capability } from "@/features/access-control/capability-model";

export type NavSubItem = {
  title: string;
  url: string;
  requiredPermission?: Capability;
};

export type NavItem = {
  title: string;
  url: string;
  icon?: ReactNode;
  requiredPermission?: Capability;
  items?: NavSubItem[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: <LayoutDashboardIcon /> },
      {
        title: "Activity",
        url: "/activity",
        icon: <ActivityIcon />,
        requiredPermission: "audit.read",
      },
      {
        title: "Analytics",
        url: "/analytics",
        icon: <ChartColumnIcon />,
        requiredPermission: "analytics.read",
      },
    ],
  },
  {
    label: "Directory",
    items: [
      {
        title: "Users",
        url: "/users",
        icon: <UsersIcon />,
        requiredPermission: "user.read",
        items: [
          { title: "All users", url: "/users", requiredPermission: "user.read" },
          { title: "Invitations", url: "/invitations", requiredPermission: "user.read" },
          { title: "Deleted", url: "/users/deleted", requiredPermission: "user.read" },
        ],
      },
      {
        title: "Organizations",
        url: "/organizations/tenants",
        icon: <Building2Icon />,
        items: [
          { title: "Tenants", url: "/organizations/tenants" },
          {
            title: "Domain verification",
            url: "/organizations/domains",
            requiredPermission: "tenant.read",
          },
        ],
      },
      {
        title: "Groups",
        url: "/groups",
        icon: <UsersRoundIcon />,
        requiredPermission: "group.read",
      },
      {
        // SCIM / LDAP are directory-sync connections, so they live under
        // Directory rather than buried in the auth-connections catalogue.
        title: "Directories",
        url: "/auth/connections/scim",
        icon: <NetworkIcon />,
        requiredPermission: "connection.read",
        items: [
          { title: "SCIM", url: "/auth/connections/scim", requiredPermission: "connection.read" },
          {
            title: "LDAP / AD",
            url: "/auth/connections/ldap",
            requiredPermission: "connection.read",
          },
        ],
      },
    ],
  },
  {
    label: "Applications",
    items: [
      {
        // The OIDC/OAuth client registry — your registered relying-party apps.
        title: "Applications",
        url: "/auth/connections/oidc",
        icon: <AppWindowIcon />,
        requiredPermission: "connection.read",
      },
      {
        title: "Machine apps",
        url: "/auth/api/machine-identities",
        icon: <CpuIcon />,
        requiredPermission: "apikey.read",
      },
      {
        title: "OAuth grants",
        url: "/auth/api/consent-grants",
        icon: <HandshakeIcon />,
        requiredPermission: "connection.read",
      },
    ],
  },
  {
    label: "Authentication",
    items: [
      {
        title: "Sign-in",
        url: "/auth/login-methods/password",
        icon: <LogInIcon />,
        requiredPermission: "policy.read",
        items: [
          {
            title: "Password",
            url: "/auth/login-methods/password",
            requiredPermission: "policy.read",
          },
          {
            title: "Passwordless",
            url: "/auth/login-methods/passwordless",
            requiredPermission: "policy.read",
          },
          { title: "Passkeys", url: "/auth/login-methods/passkeys" },
          {
            title: "Magic links",
            url: "/auth/login-methods/magic-links",
            requiredPermission: "policy.read",
          },
        ],
      },
      {
        // Single catalogue page — individual providers (Google, Microsoft,
        // Apple, GitHub, …) are configured within it, not as nav entries.
        title: "Social",
        url: "/auth/social",
        icon: <Share2Icon />,
        requiredPermission: "connection.read",
      },
      {
        title: "SSO",
        url: "/auth/connections/saml",
        icon: <WorkflowIcon />,
        requiredPermission: "connection.read",
        items: [
          { title: "SAML", url: "/auth/connections/saml", requiredPermission: "connection.read" },
          {
            title: "SAML IdP",
            url: "/auth/connections/saml-idp",
            requiredPermission: "connection.read",
          },
        ],
      },
      {
        title: "MFA",
        url: "/auth/mfa/totp",
        icon: <FingerprintIcon />,
        items: [
          { title: "TOTP", url: "/auth/mfa/totp" },
          { title: "SMS / email", url: "/auth/mfa/sms-email" },
        ],
      },
      {
        // Personal sessions live in the account/profile area; this is the
        // OAuth device-authorization surface.
        title: "Devices",
        url: "/security/device-authorizations",
        icon: <MonitorSmartphoneIcon />,
        requiredPermission: "connection.read",
      },
    ],
  },
  {
    label: "Authorization",
    items: [
      {
        title: "Overview",
        url: "/authorization",
        icon: <GaugeIcon />,
        requiredPermission: "role.read",
      },
      {
        title: "Roles",
        url: "/authorization/roles",
        icon: <ShieldCheckIcon />,
        requiredPermission: "role.read",
      },
      {
        title: "Permissions",
        url: "/authorization/permissions",
        icon: <KeyRoundIcon />,
        requiredPermission: "role.read",
      },
      {
        title: "Resources",
        url: "/authorization/resources",
        icon: <ShapesIcon />,
        requiredPermission: "role.read",
      },
      {
        title: "Models",
        url: "/authorization/rbac",
        icon: <BoxesIcon />,
        requiredPermission: "role.read",
        items: [
          { title: "RBAC", url: "/authorization/rbac", requiredPermission: "role.read" },
          { title: "ABAC", url: "/authorization/abac", requiredPermission: "policy.read" },
          { title: "ReBAC", url: "/authorization/rebac", requiredPermission: "role.read" },
        ],
      },
      {
        title: "Policies",
        url: "/authorization/builder",
        icon: <BlocksIcon />,
        requiredPermission: "policy.read",
        items: [
          { title: "Builder", url: "/authorization/builder", requiredPermission: "policy.read" },
          {
            title: "Templates",
            url: "/authorization/templates",
            requiredPermission: "policy.read",
          },
          { title: "Versions", url: "/authorization/versions", requiredPermission: "policy.read" },
        ],
      },
      {
        title: "Testing",
        url: "/authorization/simulator",
        icon: <FlaskConicalIcon />,
        requiredPermission: "role.read",
        items: [
          { title: "Simulator", url: "/authorization/simulator", requiredPermission: "role.read" },
          { title: "Explorer", url: "/authorization/explorer", requiredPermission: "role.read" },
          {
            title: "Access tester",
            url: "/authorization/access-tester",
            requiredPermission: "role.read",
          },
        ],
      },
      {
        title: "Settings",
        url: "/authorization/settings",
        icon: <Settings2Icon />,
        requiredPermission: "role.read",
      },
    ],
  },
  {
    label: "Security",
    items: [
      { title: "Overview", url: "/security", icon: <ShieldCheckIcon /> },
      {
        title: "Threats",
        url: "/security/threats/bots",
        icon: <ShieldAlertIcon />,
        requiredPermission: "policy.read",
        items: [
          { title: "Bots", url: "/security/threats/bots", requiredPermission: "policy.read" },
          {
            title: "Anomalies",
            url: "/security/threats/anomalies",
            requiredPermission: "audit.read",
          },
          {
            title: "Risk",
            url: "/security/threats/risk-settings",
            requiredPermission: "policy.read",
          },
          {
            title: "IP rules",
            url: "/security/threats/ip-allowlist",
            requiredPermission: "policy.read",
          },
        ],
      },
      {
        title: "Rate limits",
        url: "/security/threats/rate-limits",
        icon: <GaugeIcon />,
        requiredPermission: "policy.read",
      },
      {
        title: "Monitoring",
        url: "/security/audit-logs",
        icon: <ScrollTextIcon />,
        requiredPermission: "audit.read",
        items: [
          { title: "Audit logs", url: "/security/audit-logs", requiredPermission: "audit.read" },
          {
            title: "Intelligence",
            url: "/security/audit-intelligence",
            requiredPermission: "audit.read",
          },
          {
            title: "Log streams",
            url: "/security/log-streaming",
            requiredPermission: "audit.read",
          },
        ],
      },
      {
        title: "Compliance",
        url: "/security/compliance/soc2",
        icon: <LockKeyholeIcon />,
        requiredPermission: "audit.read",
        items: [
          { title: "SOC 2", url: "/security/compliance/soc2", requiredPermission: "audit.read" },
          { title: "GDPR", url: "/security/compliance/gdpr", requiredPermission: "gdpr.write" },
          {
            title: "ISO 27001",
            url: "/security/compliance/iso27001",
            requiredPermission: "audit.read",
          },
          {
            title: "Retention",
            url: "/security/compliance/retention",
            requiredPermission: "policy.read",
          },
        ],
      },
    ],
  },
  {
    label: "Developer",
    items: [
      {
        title: "API keys",
        url: "/auth/api/keys",
        icon: <KeyRoundIcon />,
        requiredPermission: "apikey.read",
      },
      {
        title: "Tokens",
        url: "/auth/api/tokens",
        icon: <TicketIcon />,
        requiredPermission: "connection.read",
      },
      {
        title: "Signing keys",
        url: "/auth/api/signing-keys",
        icon: <FileKey2Icon />,
        requiredPermission: "connection.read",
      },
      {
        title: "Secrets",
        url: "/auth/api/secrets",
        icon: <LockKeyholeIcon />,
        requiredPermission: "secret.read",
      },
      {
        title: "Webhooks",
        url: "/developer/webhooks",
        icon: <WebhookIcon />,
        requiredPermission: "webhook.read",
      },
      {
        title: "Auth hooks",
        url: "/developer/auth-hooks",
        icon: <ZapIcon />,
        requiredPermission: "connection.read",
      },
      {
        title: "Agents",
        url: "/developer/agents",
        icon: <SparklesIcon />,
        requiredPermission: "apikey.read",
      },
      {
        title: "Credentials",
        url: "/developer/credentials",
        icon: <BadgeCheckIcon />,
        requiredPermission: "apikey.read",
      },
      {
        title: "Bots",
        url: "/developer/bots",
        icon: <BotIcon />,
        requiredPermission: "apikey.read",
      },
      {
        title: "Infrastructure",
        url: "/developer/infrastructure",
        icon: <ServerCogIcon />,
        requiredPermission: "audit.read",
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        title: "General",
        url: "/settings/organization/general",
        icon: <Settings2Icon />,
        requiredPermission: "tenant.read",
      },
      {
        title: "Domains",
        url: "/settings/organization/domains",
        icon: <GlobeIcon />,
        requiredPermission: "tenant.read",
      },
      {
        title: "Branding",
        url: "/settings/branding",
        icon: <PaletteIcon />,
        requiredPermission: "branding.write",
      },
      {
        title: "Emails",
        url: "/settings/organization/email-templates",
        icon: <MailIcon />,
        requiredPermission: "branding.write",
      },
      {
        title: "Security",
        url: "/settings/organization/security-policy",
        icon: <ShieldCheckIcon />,
        requiredPermission: "policy.read",
      },
      {
        title: "Billing",
        url: "/settings/billing",
        icon: <CreditCardIcon />,
        requiredPermission: "billing.read",
      },
    ],
  },
];

export type NavTitleLookup = {
  group?: string;
  parent?: { title: string; url: string };
  title: string;
};

const ROUTE_REQUIREMENT_OVERRIDES: ReadonlyArray<{
  path: string;
  requiredPermission: Capability;
}> = [{ path: "/users/import", requiredPermission: "user.write" }];

const SAFE_DESTINATIONS = new Set(["/", "/organizations/tenants"]);

function normalizePathname(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  if (path === "/") return path;
  return path.replace(/\/+$/, "") || "/";
}

function pathMatchesBranch(pathname: string, destination: string): boolean {
  return (
    pathname === destination || (destination !== "/" && pathname.startsWith(`${destination}/`))
  );
}

function destinations(): Array<NavItem | NavSubItem> {
  return navGroups.flatMap((group) => group.items.flatMap((item) => [item, ...(item.items ?? [])]));
}

export function getRequiredCapabilityForPath(pathname: string): Capability | undefined {
  const normalized = normalizePathname(pathname);
  const override = ROUTE_REQUIREMENT_OVERRIDES.find((entry) => entry.path === normalized);
  if (override) return override.requiredPermission;

  return destinations()
    .filter((item) => pathMatchesBranch(normalized, item.url))
    .sort((a, b) => b.url.length - a.url.length)[0]?.requiredPermission;
}

export function filterNavigation(
  groups: NavGroup[],
  can: (permission?: Capability) => boolean,
): NavGroup[] {
  return groups.flatMap((group) => {
    const items = group.items.flatMap((item) => {
      const visibleChildren = item.items?.filter((child) => can(child.requiredPermission));
      const ownRouteVisible = can(item.requiredPermission);
      if (!ownRouteVisible && (!visibleChildren || visibleChildren.length === 0)) return [];
      return [{ ...item, items: visibleChildren }];
    });
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

export function safeNavigation(groups: NavGroup[]): NavGroup[] {
  return groups.flatMap((group) => {
    const items = group.items.flatMap((item) => {
      const visibleChildren = item.items?.filter((child) => SAFE_DESTINATIONS.has(child.url));
      const ownRouteVisible = SAFE_DESTINATIONS.has(item.url);
      if (!ownRouteVisible && (!visibleChildren || visibleChildren.length === 0)) return [];
      return [{ ...item, items: visibleChildren }];
    });
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function lookupNavTitle(pathname: string): NavTitleLookup {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.url === pathname) {
        return { group: group.label, title: item.title };
      }
      const sub = item.items?.find((s) => s.url === pathname);
      if (sub) {
        return {
          group: group.label,
          parent: { title: item.title, url: item.url },
          title: sub.title,
        };
      }
    }
  }
  const segments = pathname.split("/").filter(Boolean);
  return { title: titleFromSlug(segments[segments.length - 1] ?? "Page") };
}
