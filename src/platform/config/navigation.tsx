import {
  Activity,
  BoxAlt,
  Buildings,
  Card,
  Category,
  Chart,
  Code,
  ColorSwatch,
  Cpu,
  CpuSetting,
  DocumentText,
  FingerScan,
  Flash,
  Global,
  GridBlocks,
  Hierarchy,
  HierarchySquare,
  Key,
  Login,
  MagicStar,
  Monitor,
  MonitorMobile,
  Padlock,
  People,
  ProfilePair,
  Routing,
  SettingAlt,
  Shapes,
  Share,
  ShieldSecurity,
  ShieldTick,
  Sms,
  Speedometer,
  Ticket,
  ToyRobot,
  Verify,
} from "@qeetrix/icons";
import type { ReactNode } from "react";

import type { Capability } from "@/platform/security/capability-model";

export type NavSubItem = {
  title: string;
  url: string;
  requiredPermission?: Capability;
};

export type NavItem = {
  title: string;
  url: string;
  icon?: ReactNode;
  /** One-line summary shown on section overview cards. */
  description?: string;
  requiredPermission?: Capability;
  items?: NavSubItem[];
};

export type NavGroup = {
  label: string;
  /** Rail icon for the two-pane sidebar switcher; required for every group. */
  icon: ReactNode;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    icon: <Category />,
    items: [
      { title: "Dashboard", url: "/", icon: <Category /> },
      {
        title: "Activity",
        url: "/activity",
        icon: <Activity />,
        requiredPermission: "audit.read",
      },
      {
        title: "Analytics",
        url: "/analytics",
        icon: <Chart />,
        requiredPermission: "analytics.read",
      },
    ],
  },
  {
    label: "Directory",
    icon: <People />,
    items: [
      { title: "Overview", url: "/directory", icon: <Speedometer /> },
      {
        title: "Users",
        url: "/users",
        icon: <People />,
        description: "People with access to your organization.",
        requiredPermission: "user.read",
        items: [
          { title: "All users", url: "/users", requiredPermission: "user.read" },
          { title: "Invitations", url: "/invitations", requiredPermission: "user.read" },
          { title: "Deleted", url: "/users/deleted", requiredPermission: "user.read" },
        ],
      },
      {
        // Domain verification moved into Settings › Domains (tabbed with the
        // custom login domain), so Organizations is now a single destination.
        title: "Organizations",
        url: "/organizations/tenants",
        icon: <Buildings />,
        description: "Tenant boundaries, plans and regions.",
      },
      {
        title: "Groups",
        url: "/groups",
        icon: <People />,
        description: "Bundle users to grant access together.",
        requiredPermission: "group.read",
      },
      {
        // SCIM / LDAP are directory-sync connections, so they live under
        // Directory rather than buried in the auth-connections catalogue.
        title: "Directories",
        url: "/auth/connections/scim",
        icon: <Hierarchy />,
        description: "SCIM and LDAP / AD directory-sync connections.",
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
    icon: <Monitor />,
    items: [
      { title: "Overview", url: "/applications", icon: <Speedometer /> },
      {
        // The OIDC/OAuth client registry — your registered relying-party apps.
        title: "Applications",
        url: "/auth/connections/oidc",
        icon: <Monitor />,
        description: "Your registered OIDC / OAuth relying-party apps.",
        requiredPermission: "connection.read",
      },
      {
        title: "Machine apps",
        url: "/auth/api/machine-identities",
        icon: <Cpu />,
        description: "Non-interactive service and machine identities.",
        requiredPermission: "apikey.read",
      },
      {
        title: "OAuth grants",
        url: "/auth/api/consent-grants",
        icon: <ProfilePair />,
        description: "Consents users have granted to your apps.",
        requiredPermission: "connection.read",
      },
    ],
  },
  {
    label: "Authentication",
    icon: <FingerScan />,
    items: [
      { title: "Overview", url: "/authentication", icon: <Speedometer /> },
      {
        title: "Sign-in",
        url: "/auth/login-methods/password",
        icon: <Login />,
        description: "Password, passwordless, passkeys and magic links.",
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
        icon: <Share />,
        description: "Google, Microsoft, Apple, GitHub and more.",
        requiredPermission: "connection.read",
      },
      {
        title: "SSO",
        url: "/auth/connections/saml",
        icon: <HierarchySquare />,
        description: "SAML connections and Qeet ID as an IdP.",
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
        icon: <FingerScan />,
        description: "TOTP and SMS / email second factors.",
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
        icon: <MonitorMobile />,
        description: "OAuth device-authorization requests.",
        requiredPermission: "connection.read",
      },
    ],
  },
  {
    label: "Authorization",
    icon: <Key />,
    items: [
      {
        title: "Overview",
        url: "/authorization",
        icon: <Speedometer />,
        requiredPermission: "role.read",
      },
      {
        title: "Roles",
        url: "/authorization/roles",
        icon: <ShieldTick />,
        requiredPermission: "role.read",
      },
      {
        title: "Permissions",
        url: "/authorization/permissions",
        icon: <Key />,
        requiredPermission: "role.read",
      },
      {
        title: "Resources",
        url: "/authorization/resources",
        icon: <Shapes />,
        requiredPermission: "role.read",
      },
      {
        title: "Models",
        url: "/authorization/rbac",
        icon: <BoxAlt />,
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
        icon: <GridBlocks />,
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
        icon: <MagicStar />,
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
        icon: <SettingAlt />,
        requiredPermission: "role.read",
      },
    ],
  },
  {
    label: "Security",
    icon: <ShieldTick />,
    items: [
      { title: "Overview", url: "/security", icon: <ShieldTick /> },
      {
        title: "Threats",
        url: "/security/threats/bots",
        icon: <ShieldSecurity />,
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
        icon: <Speedometer />,
        requiredPermission: "policy.read",
      },
      {
        title: "Monitoring",
        url: "/security/audit-logs",
        icon: <DocumentText />,
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
        icon: <Padlock />,
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
    icon: <Code />,
    items: [
      { title: "Overview", url: "/developer", icon: <Speedometer /> },
      {
        title: "API keys",
        url: "/auth/api/keys",
        icon: <Key />,
        description: "Programmatic access keys for the API.",
        requiredPermission: "apikey.read",
      },
      {
        title: "Tokens",
        url: "/auth/api/tokens",
        icon: <Ticket />,
        description: "Issued access and refresh tokens.",
        requiredPermission: "connection.read",
      },
      {
        title: "Signing keys",
        url: "/auth/api/signing-keys",
        icon: <DocumentText />,
        description: "JWKS keys that sign your tokens.",
        requiredPermission: "connection.read",
      },
      {
        title: "Secrets",
        url: "/auth/api/secrets",
        icon: <Padlock />,
        description: "Encrypted secrets for integrations.",
        requiredPermission: "secret.read",
      },
      {
        title: "Webhooks",
        url: "/developer/webhooks",
        icon: <Routing />,
        description: "Subscribe endpoints to Qeet ID events.",
        requiredPermission: "webhook.read",
      },
      {
        title: "Auth hooks",
        url: "/developer/auth-hooks",
        icon: <Flash />,
        description: "Run custom logic in the auth pipeline.",
        requiredPermission: "connection.read",
      },
      {
        title: "Agents",
        url: "/developer/agents",
        icon: <MagicStar />,
        description: "AI agent identities and credentials.",
        requiredPermission: "apikey.read",
      },
      {
        title: "Credentials",
        url: "/developer/credentials",
        icon: <Verify />,
        description: "Verifiable credential issuance.",
        requiredPermission: "apikey.read",
      },
      {
        title: "Bots",
        url: "/developer/bots",
        icon: <ToyRobot />,
        description: "Automated bot identities.",
        requiredPermission: "apikey.read",
      },
      {
        title: "Infrastructure",
        url: "/developer/infrastructure",
        icon: <CpuSetting />,
        description: "Runtime, regions and system health.",
        requiredPermission: "audit.read",
      },
    ],
  },
  {
    label: "Settings",
    icon: <SettingAlt />,
    items: [
      { title: "Overview", url: "/settings", icon: <Speedometer /> },
      {
        title: "General",
        url: "/settings/organization/general",
        icon: <SettingAlt />,
        description: "Organization name, profile and defaults.",
        requiredPermission: "tenant.read",
      },
      {
        title: "Domains",
        url: "/settings/organization/domains",
        icon: <Global />,
        description: "Verified domains and the custom login URL.",
        requiredPermission: "tenant.read",
      },
      {
        title: "Branding",
        url: "/settings/branding",
        icon: <ColorSwatch />,
        description: "Logo, colors and hosted-page theme.",
        requiredPermission: "branding.write",
      },
      {
        title: "Emails",
        url: "/settings/organization/email-templates",
        icon: <Sms />,
        description: "Customize transactional email templates.",
        requiredPermission: "branding.write",
      },
      {
        title: "Security",
        url: "/settings/organization/security-policy",
        icon: <ShieldTick />,
        description: "Org-wide security and session policy.",
        requiredPermission: "policy.read",
      },
      {
        title: "Billing",
        url: "/settings/billing",
        icon: <Card />,
        description: "Plan, usage, invoices and payment.",
        requiredPermission: "billing.read",
      },
      {
        title: "Qeet AI",
        url: "/settings/qeet-ai",
        icon: <MagicStar />,
        description: "Bring your own AI provider key.",
        requiredPermission: "secret.read",
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

/**
 * Resolves which group the two-pane rail should highlight for a route, using the
 * longest matching destination so `/authorization/roles/42` selects Authorization
 * rather than a shorter-prefixed sibling. Returns undefined for unmapped routes.
 */
export function findNavGroupForPath(groups: NavGroup[], pathname: string): string | undefined {
  const normalized = normalizePathname(pathname);
  let bestLabel: string | undefined;
  let bestLength = -1;
  for (const group of groups) {
    for (const item of group.items) {
      for (const dest of [item, ...(item.items ?? [])]) {
        if (pathMatchesBranch(normalized, dest.url) && dest.url.length > bestLength) {
          bestLabel = group.label;
          bestLength = dest.url.length;
        }
      }
    }
  }
  return bestLabel;
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
