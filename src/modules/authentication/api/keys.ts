// An organization's sign-in configuration sits under ["authentication", organizationId]; see
// src/modules/users/api/keys.ts. The signed-in person's own factors, sessions and links sit under
// ["authentication", "me"]: the session names the person, sign-out clears the cache and switching
// organization reloads the page. Pre-sign-in flows have no organization yet: ["authentication", "flow"].

const me = ["authentication", "me"] as const;
const flow = ["authentication", "flow"] as const;

export const authKeys = {
  all: ["authentication"] as const,
  organization: (organizationId: string | null) => ["authentication", organizationId] as const,
  policy: (organizationId: string | null) =>
    [...authKeys.organization(organizationId), "policy"] as const,
  adminPortalLinks: (organizationId: string | null) =>
    [...authKeys.organization(organizationId), "admin-portal-links"] as const,
  ldap: (organizationId: string | null) =>
    [...authKeys.organization(organizationId), "ldap"] as const,
  saml: (organizationId: string | null) =>
    [...authKeys.organization(organizationId), "saml"] as const,
  samlProviders: (organizationId: string | null) =>
    [...authKeys.organization(organizationId), "saml-providers"] as const,
  scim: (organizationId: string | null) =>
    [...authKeys.organization(organizationId), "scim"] as const,
  scimConfig: (organizationId: string | null) =>
    [...authKeys.scim(organizationId), "config"] as const,
  scimUsers: (organizationId: string | null) =>
    [...authKeys.scim(organizationId), "users"] as const,
  socialProviders: (organizationId: string | null) =>
    [...authKeys.organization(organizationId), "social-providers"] as const,
  // One application's record and its failure feed sit under the list, which its changes refresh.
  oidcClients: (organizationId: string | null) =>
    [...authKeys.organization(organizationId), "oidc-clients"] as const,
  oidcClient: (organizationId: string | null, id: string) =>
    [...authKeys.oidcClients(organizationId), id] as const,
  oidcClientFailures: (organizationId: string | null, id: string | undefined) =>
    [...authKeys.oidcClients(organizationId), id, "auth-failures"] as const,
  shadowAi: (organizationId: string | null) =>
    [...authKeys.organization(organizationId), "shadow-ai"] as const,
  oauthGrants: (organizationId: string | null) =>
    [...authKeys.organization(organizationId), "oauth-grants"] as const,
  trustedDeviceCount: (organizationId: string | null) =>
    [...authKeys.organization(organizationId), "trusted-device-count"] as const,

  me,
  passkeys: () => [...me, "passkeys"] as const,
  sessions: () => [...me, "sessions"] as const,
  signInMethods: () => [...me, "sign-in-methods"] as const,
  socialIdentities: () => [...me, "social-identities"] as const,
  passwordStatus: () => [...me, "password-status"] as const,
  totp: () => [...me, "totp"] as const,
  recoveryCodes: () => [...me, "recovery-codes"] as const,
  otpFactors: () => [...me, "otp-factors"] as const,
  invitations: () => [...me, "invitations"] as const,
  trustedDevices: () => [...me, "trusted-devices"] as const,
  pushDevices: () => [...me, "push-devices"] as const,
  pushPairing: (id: string | null) => [...me, "push-pairing", id] as const,

  flow,
  invitePreview: (token: string) => [...flow, "invite-preview", token] as const,
  ssoDiscovery: (email: string) => [...flow, "sso-discovery", email] as const,
  eligibleOrganizations: (userId: string | null) =>
    [...flow, "eligible-organizations", userId] as const,
  platformSocialProviders: () => [...flow, "platform-social-providers"] as const,
};
