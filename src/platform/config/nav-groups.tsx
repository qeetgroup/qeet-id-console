import {
  ActivityIcon,
  AppWindowIcon,
  BuildingComplexIcon,
  ChartColumnIcon,
  CpuIcon,
  FingerprintPatternIcon,
  GaugeIcon,
  HandshakeIcon,
  LayoutDashboardIcon,
  LogInIcon,
  MonitorSmartphoneIcon,
  NetworkIcon,
  Share2Icon,
  UsersIcon,
  UsersRoundIcon,
  WorkflowIcon,
} from "@qeetrix/icons";

import { ADMIN_NAV_GROUPS } from "./nav-groups-admin";
import type { NavGroup } from "./navigation";

/**
 * The sidebar's sections in order. Every label, title and description is a `nav` catalogue key;
 * `useNavGroups()` returns them translated.
 */
export const navGroups: NavGroup[] = [
  {
    id: "overview",
    label: "nav:overview.label",
    icon: <LayoutDashboardIcon />,
    items: [
      { title: "nav:overview.title.dashboard", url: "/", icon: <LayoutDashboardIcon /> },
      {
        title: "nav:overview.title.activity",
        url: "/activity",
        icon: <ActivityIcon />,
        requiredPermission: "audit.read",
      },
      {
        title: "nav:overview.title.analytics",
        url: "/analytics",
        icon: <ChartColumnIcon />,
        requiredPermission: "analytics.read",
      },
    ],
  },
  {
    id: "directory",
    label: "nav:directory.label",
    icon: <UsersIcon />,
    items: [
      { title: "nav:directory.title.overview", url: "/directory", icon: <GaugeIcon /> },
      {
        title: "nav:directory.title.users",
        url: "/users",
        icon: <UsersIcon />,
        description: "nav:directory.description.users",
        requiredPermission: "user.read",
        items: [
          { title: "nav:directory.title.allUsers", url: "/users", requiredPermission: "user.read" },
          {
            title: "nav:directory.title.invitations",
            url: "/invitations",
            requiredPermission: "user.read",
          },
          {
            title: "nav:directory.title.suspended",
            url: "/users/suspended",
            requiredPermission: "user.read",
          },
          {
            title: "nav:directory.title.deleted",
            url: "/users/deleted",
            requiredPermission: "user.read",
          },
        ],
      },
      {
        title: "nav:directory.title.groups",
        url: "/groups",
        icon: <UsersRoundIcon />,
        description: "nav:directory.description.groups",
        requiredPermission: "group.read",
      },
      {
        // Domain verification lives in Settings › Domains, so Organizations has no sub-items.
        title: "nav:directory.title.organizations",
        url: "/organizations",
        icon: <BuildingComplexIcon />,
        description: "nav:directory.description.organizations",
      },
      {
        // SCIM and LDAP sync directories, so they sit here, not in the auth-connections catalogue.
        title: "nav:directory.title.directories",
        url: "/directory/connections",
        icon: <NetworkIcon />,
        description: "nav:directory.description.directories",
        requiredPermission: "connection.read",
        items: [
          {
            title: "nav:directory.title.connections",
            url: "/directory/connections",
            requiredPermission: "connection.read",
          },
          {
            title: "nav:directory.title.scim",
            url: "/auth/connections/scim",
            requiredPermission: "connection.read",
          },
          {
            title: "nav:directory.title.ldapAd",
            url: "/auth/connections/ldap",
            requiredPermission: "connection.read",
          },
          {
            title: "nav:directory.title.syncActivity",
            url: "/directory/sync-activity",
            requiredPermission: "connection.read",
          },
          {
            title: "nav:directory.title.syncErrors",
            url: "/directory/sync-errors",
            requiredPermission: "connection.read",
          },
          {
            title: "nav:directory.title.mappings",
            url: "/directory/attribute-mappings",
            requiredPermission: "connection.read",
          },
        ],
      },
    ],
  },
  {
    id: "applications",
    label: "nav:applications.label",
    icon: <AppWindowIcon />,
    items: [
      { title: "nav:applications.title.overview", url: "/applications", icon: <GaugeIcon /> },
      {
        title: "nav:applications.title.applications",
        url: "/auth/connections/oidc",
        icon: <AppWindowIcon />,
        description: "nav:applications.description.applications",
        requiredPermission: "connection.read",
      },
      {
        title: "nav:applications.title.machineApps",
        url: "/auth/api/machine-identities",
        icon: <CpuIcon />,
        description: "nav:applications.description.machineApps",
        requiredPermission: "apikey.read",
      },
      {
        title: "nav:applications.title.oauthGrants",
        url: "/auth/api/consent-grants",
        icon: <HandshakeIcon />,
        description: "nav:applications.description.oauthGrants",
        requiredPermission: "connection.read",
      },
    ],
  },
  {
    id: "authentication",
    label: "nav:authentication.label",
    icon: <FingerprintPatternIcon />,
    items: [
      { title: "nav:authentication.title.overview", url: "/authentication", icon: <GaugeIcon /> },
      {
        title: "nav:authentication.title.signIn",
        url: "/auth/login-methods/password",
        icon: <LogInIcon />,
        description: "nav:authentication.description.signIn",
        requiredPermission: "policy.read",
        items: [
          {
            title: "nav:authentication.title.password",
            url: "/auth/login-methods/password",
            requiredPermission: "policy.read",
          },
          {
            title: "nav:authentication.title.passwordless",
            url: "/auth/login-methods/passwordless",
            requiredPermission: "policy.read",
          },
          { title: "nav:authentication.title.passkeys", url: "/auth/login-methods/passkeys" },
          {
            title: "nav:authentication.title.magicLinks",
            url: "/auth/login-methods/magic-links",
            requiredPermission: "policy.read",
          },
        ],
      },
      {
        // One catalogue page: each provider is configured inside it, not as a nav entry.
        title: "nav:authentication.title.social",
        url: "/auth/social",
        icon: <Share2Icon />,
        description: "nav:authentication.description.social",
        requiredPermission: "connection.read",
      },
      {
        title: "nav:authentication.title.sso",
        url: "/auth/connections/saml",
        icon: <WorkflowIcon />,
        description: "nav:authentication.description.sso",
        requiredPermission: "connection.read",
        items: [
          {
            title: "nav:authentication.title.saml",
            url: "/auth/connections/saml",
            requiredPermission: "connection.read",
          },
          {
            title: "nav:authentication.title.samlIdp",
            url: "/auth/connections/saml-idp",
            requiredPermission: "connection.read",
          },
        ],
      },
      {
        title: "nav:authentication.title.mfa",
        url: "/auth/mfa/totp",
        icon: <FingerprintPatternIcon />,
        description: "nav:authentication.description.mfa",
        items: [
          { title: "nav:authentication.title.totp", url: "/auth/mfa/totp" },
          { title: "nav:authentication.title.smsEmail", url: "/auth/mfa/sms-email" },
        ],
      },
      {
        // OAuth device authorization; a person's own sessions are in the account area.
        title: "nav:authentication.title.devices",
        url: "/security/device-authorizations",
        icon: <MonitorSmartphoneIcon />,
        description: "nav:authentication.description.devices",
        requiredPermission: "connection.read",
      },
    ],
  },
  ...ADMIN_NAV_GROUPS,
];
