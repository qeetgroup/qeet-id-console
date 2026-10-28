// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import {
  AppWindowIcon,
  FingerprintPatternIcon,
  HandshakeIcon,
  LinkIcon,
  LogInIcon,
  Share2Icon,
  ShieldCheckIcon,
  TicketIcon,
  WorkflowIcon,
} from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "authentication",
  nav: [
    {
      id: "applications.applications",
      group: "applications",
      order: 20,
      title: "authentication:nav.applications.applications.title",
      description: "authentication:nav.applications.applications.description",
      url: "/auth/connections/oidc",
      icon: <AppWindowIcon />,
      capability: "connection.read",
    },
    {
      id: "applications.oauthGrants",
      group: "applications",
      order: 40,
      title: "authentication:nav.applications.oauthGrants.title",
      description: "authentication:nav.applications.oauthGrants.description",
      url: "/auth/api/consent-grants",
      icon: <HandshakeIcon />,
      capability: "connection.read",
    },
    {
      id: "authentication.signIn",
      group: "authentication",
      order: 20,
      title: "authentication:nav.authentication.signIn.title",
      description: "authentication:nav.authentication.signIn.description",
      url: "/auth/login-methods/password",
      icon: <LogInIcon />,
      capability: "policy.read",
    },
    {
      id: "authentication.password",
      group: "authentication",
      parent: "authentication.signIn",
      order: 10,
      title: "authentication:nav.authentication.password.title",
      url: "/auth/login-methods/password",
      capability: "policy.read",
    },
    {
      id: "authentication.passwordless",
      group: "authentication",
      parent: "authentication.signIn",
      order: 20,
      title: "authentication:nav.authentication.passwordless.title",
      url: "/auth/login-methods/passwordless",
      capability: "policy.read",
    },
    {
      id: "authentication.passkeys",
      group: "authentication",
      parent: "authentication.signIn",
      order: 30,
      title: "authentication:nav.authentication.passkeys.title",
      url: "/auth/login-methods/passkeys",
    },
    {
      id: "authentication.magicLinks",
      group: "authentication",
      parent: "authentication.signIn",
      order: 40,
      title: "authentication:nav.authentication.magicLinks.title",
      url: "/auth/login-methods/magic-links",
      capability: "policy.read",
    },
    {
      id: "authentication.social",
      group: "authentication",
      order: 30,
      title: "authentication:nav.authentication.social.title",
      description: "authentication:nav.authentication.social.description",
      url: "/auth/social",
      icon: <Share2Icon />,
      capability: "connection.read",
    },
    {
      // SSO opens the one list of SAML sign-in connections and SAML apps, with the setup links.
      id: "authentication.sso",
      group: "authentication",
      order: 40,
      title: "authentication:nav.authentication.sso.title",
      description: "authentication:nav.authentication.sso.description",
      url: "/auth/connections/saml",
      icon: <WorkflowIcon />,
      capability: "connection.read",
    },
    {
      id: "authentication.saml",
      group: "authentication",
      parent: "authentication.sso",
      order: 10,
      title: "authentication:nav.authentication.saml.title",
      url: "/auth/connections/saml",
      capability: "connection.read",
    },
    {
      id: "authentication.samlIdp",
      group: "authentication",
      parent: "authentication.sso",
      order: 20,
      title: "authentication:nav.authentication.samlIdp.title",
      url: "/auth/connections/saml-idp",
      capability: "connection.read",
    },
    {
      id: "authentication.mfa",
      group: "authentication",
      order: 50,
      title: "authentication:nav.authentication.mfa.title",
      description: "authentication:nav.authentication.mfa.description",
      url: "/auth/mfa/totp",
      icon: <FingerprintPatternIcon />,
    },
    {
      id: "authentication.totp",
      group: "authentication",
      parent: "authentication.mfa",
      order: 10,
      title: "authentication:nav.authentication.totp.title",
      url: "/auth/mfa/totp",
    },
    {
      id: "authentication.smsEmail",
      group: "authentication",
      parent: "authentication.mfa",
      order: 20,
      title: "authentication:nav.authentication.smsEmail.title",
      url: "/auth/mfa/sms-email",
    },
    {
      id: "developer.tokens",
      group: "developer",
      order: 30,
      title: "authentication:nav.developer.tokens.title",
      description: "authentication:nav.developer.tokens.description",
      url: "/auth/api/tokens",
      icon: <TicketIcon />,
      capability: "connection.read",
    },
  ],
  commands: [
    {
      id: "cmd.navigate.oauth-clients",
      text: "authentication:commands.oauthClients",
      icon: <LogInIcon className="size-4" />,
      to: "/auth/connections/oidc",
      capability: "connection.write",
    },
    {
      // Setup links live on the SSO list, a search away.
      id: "cmd.navigate.setup-links",
      text: "authentication:commands.setupLinks",
      icon: <LinkIcon className="size-4" />,
      to: "/auth/connections/saml",
      capability: "connection.read",
    },
    {
      id: "cmd.navigate.passkeys",
      text: "authentication:commands.passkeys",
      icon: <FingerprintPatternIcon className="size-4" />,
      to: "/auth/login-methods/passkeys",
    },
    {
      id: "cmd.navigate.mfa",
      text: "authentication:commands.mfa",
      icon: <ShieldCheckIcon className="size-4" />,
      to: "/auth/mfa/totp",
    },
  ],
});

// Types its translation keys from the English catalogues (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    "auth-flow": typeof import("./locales/en/auth-flow.json");
    authentication: typeof import("./locales/en/authentication.json");
    connections: typeof import("./locales/en/connections.json");
    consent: typeof import("./locales/en/consent.json");
    oidc: typeof import("./locales/en/oidc.json");
    saml: typeof import("./locales/en/saml.json");
  }
}
