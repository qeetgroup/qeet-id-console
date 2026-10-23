// An organization's sign-in configuration sits under ["authentication", tenantId]; see
// src/modules/users/api/keys.ts. The signed-in person's own factors, sessions and links sit under
// ["authentication", "me"]: the session names the person, sign-out clears the cache and switching
// organization reloads the page. Pre-sign-in flows have no organization yet: ["authentication", "flow"].

const me = ["authentication", "me"] as const;
const flow = ["authentication", "flow"] as const;

export const authKeys = {
  all: ["authentication"] as const,
  tenant: (tenantId: string | null) => ["authentication", tenantId] as const,
  policy: (tenantId: string | null) => [...authKeys.tenant(tenantId), "policy"] as const,
  adminPortalLinks: (tenantId: string | null) =>
    [...authKeys.tenant(tenantId), "admin-portal-links"] as const,
  ldap: (tenantId: string | null) => [...authKeys.tenant(tenantId), "ldap"] as const,
  saml: (tenantId: string | null) => [...authKeys.tenant(tenantId), "saml"] as const,
  samlProviders: (tenantId: string | null) =>
    [...authKeys.tenant(tenantId), "saml-providers"] as const,
  scim: (tenantId: string | null) => [...authKeys.tenant(tenantId), "scim"] as const,
  scimConfig: (tenantId: string | null) => [...authKeys.scim(tenantId), "config"] as const,
  scimUsers: (tenantId: string | null) => [...authKeys.scim(tenantId), "users"] as const,
  socialProviders: (tenantId: string | null) =>
    [...authKeys.tenant(tenantId), "social-providers"] as const,
  // One application's record and its failure feed sit under the list, which its changes refresh.
  oidcClients: (tenantId: string | null) => [...authKeys.tenant(tenantId), "oidc-clients"] as const,
  oidcClient: (tenantId: string | null, id: string) =>
    [...authKeys.oidcClients(tenantId), id] as const,
  oidcClientFailures: (tenantId: string | null, id: string | undefined) =>
    [...authKeys.oidcClients(tenantId), id, "auth-failures"] as const,
  shadowAi: (tenantId: string | null) => [...authKeys.tenant(tenantId), "shadow-ai"] as const,
  oauthGrants: (tenantId: string | null) => [...authKeys.tenant(tenantId), "oauth-grants"] as const,
  trustedDeviceCount: (tenantId: string | null) =>
    [...authKeys.tenant(tenantId), "trusted-device-count"] as const,

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
