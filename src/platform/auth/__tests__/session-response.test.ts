import { describe, expect, it, vi } from "vitest";

import {
  organizationSelectionBlocksPath,
  organizationSelectionPageSchema,
  requiresOrganizationSelection,
  signInRequiresOrganizationSelection,
} from "../organization-selection";

import {
  isBackendTokenResponse,
  isSessionIssuingRequest,
  isSignInRequest,
  serverSessionData,
  stripBackendTokens,
} from "../session-response";

const tokenResponse = {
  access_token: "access-secret",
  refresh_token: "refresh-secret",
  token_type: "Bearer",
  expires_at: "2030-01-01T00:00:00Z",
  session_id: "session-1",
  user_id: "user-1",
  organization_id: "org-1",
};

describe("session response policy", () => {
  it("requires a choice only for multiple eligible organizations", () => {
    const organization = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Example",
      slug: "example",
      plan: "free",
      region: "us-east-1",
      logo_url: "",
      domain: "",
      roles: ["owner"],
      last_used_at: null,
    };
    expect(requiresOrganizationSelection({ items: [] })).toBe(false);
    expect(requiresOrganizationSelection({ items: [organization] })).toBe(false);
    expect(
      requiresOrganizationSelection({
        items: [organization, { ...organization, id: "22222222-2222-4222-8222-222222222222" }],
      }),
    ).toBe(true);
    expect(requiresOrganizationSelection({ items: [organization], next_cursor: "more" })).toBe(
      true,
    );
  });

  it("reads the last page, which leaves next_cursor out, as complete", () => {
    const own = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Example",
      slug: "example",
      plan: "free",
      region: "us-east-1",
      logo_url: "",
      domain: "",
      roles: [],
      last_used_at: null,
    };
    const page = organizationSelectionPageSchema.parse({ items: [own] });
    expect(page.next_cursor).toBeUndefined();
    expect(requiresOrganizationSelection({ items: [own] })).toBe(false);
  });

  it("refuses a membership whose roles aren't a list, so a bad answer keeps selection pending", () => {
    expect(
      organizationSelectionPageSchema.safeParse({
        items: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Example",
            slug: "example",
            plan: "free",
            region: "us-east-1",
            logo_url: "",
            domain: "",
            roles: null,
            last_used_at: null,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("keeps selection pending on missing, failed or malformed membership data", async () => {
    expect(requiresOrganizationSelection(null)).toBe(true);
    expect(requiresOrganizationSelection({ items: [{}] })).toBe(true);
    expect(
      await signInRequiresOrganizationSelection("/v1/auth/login", "POST", async () => {
        throw new Error("offline");
      }),
    ).toBe(true);
    expect(
      await signInRequiresOrganizationSelection("/v1/auth/mfa", "POST", async () => ({
        items: [],
      })),
    ).toBe(false);
  });

  it("does not look up organizations during signup or explicit organization transitions", async () => {
    const load = vi.fn();
    for (const path of [
      "/v1/auth/signup",
      "/v1/signup/passkey/finish",
      "/v1/organizations",
      "/v1/auth/switch-organization",
      "/v1/invites/accept",
    ]) {
      expect(await signInRequiresOrganizationSelection(path, "POST", load)).toBe(false);
    }
    expect(load).not.toHaveBeenCalled();
  });

  it("blocks dashboard and organization deep links while allowing personal account settings", () => {
    expect(organizationSelectionBlocksPath(true, "/")).toBe(true);
    expect(organizationSelectionBlocksPath(true, "/directory/users")).toBe(true);
    expect(organizationSelectionBlocksPath(true, "/settings/billing")).toBe(true);
    expect(organizationSelectionBlocksPath(true, "/account/profile")).toBe(false);
    expect(organizationSelectionBlocksPath(false, "/")).toBe(false);
    expect(organizationSelectionBlocksPath(undefined, "/")).toBe(false);
  });

  it("checks organization choice after completed sign-in, not signup or organization creation", () => {
    for (const path of [
      "/v1/auth/login",
      "/v1/auth/mfa",
      "/v1/auth/magic-link/consume",
      "/v1/passkeys/login/finish",
      "/v1/social/exchange",
      "/saml/exchange",
    ]) {
      expect(isSignInRequest(path, "POST")).toBe(true);
      expect(isSignInRequest(path, "GET")).toBe(false);
    }
    for (const path of [
      "/v1/auth/signup",
      "/v1/signup/passkey/finish",
      "/v1/organizations",
      "/v1/auth/switch-organization",
      "/v1/auth/refresh",
      "/v1/invites/accept",
      "/v1/me/invites/example/accept",
      "/v1/me/invites/accept",
    ]) {
      expect(isSignInRequest(path, "POST")).toBe(false);
    }
  });

  it("adopts token pairs only from explicit authentication transitions", () => {
    expect(isSessionIssuingRequest("/v1/auth/login", "POST")).toBe(true);
    expect(isSessionIssuingRequest("/v1/auth/switch-organization", "POST")).toBe(true);
    expect(isSessionIssuingRequest("/v1/passkeys/login/finish", "POST")).toBe(true);
    expect(isSessionIssuingRequest("/v1/signup/passkey/finish", "POST")).toBe(true);
    expect(isSessionIssuingRequest("/v1/me/invites/invite-1/accept", "POST")).toBe(true);
    expect(isSessionIssuingRequest("/v1/me/invites/accept", "POST")).toBe(true);
    expect(isSessionIssuingRequest("/v1/organizations", "POST")).toBe(true);

    // Paths the server no longer has never hand the BFF a token pair to keep.
    for (const removed of [
      "/v1/auth/switch-tenant",
      "/v1/tenants",
      "/v1/admin/impersonate",
      "/v1/admin/impersonate/exit",
    ]) {
      expect(isSessionIssuingRequest(removed, "POST")).toBe(false);
    }
    expect(isSessionIssuingRequest("/v1/oauth/token", "POST")).toBe(false);
    expect(isSessionIssuingRequest("/v1/credentials/issue", "POST")).toBe(false);
    expect(isSessionIssuingRequest("/v1/passkeys/signup/finish", "POST")).toBe(false);
    expect(isSessionIssuingRequest("/v1/signup/passkey/begin", "POST")).toBe(false);
    expect(isSessionIssuingRequest("/v1/signup/passkey/finish", "GET")).toBe(false);
    expect(isSessionIssuingRequest("/v1/passkeys/login/finish", "GET")).toBe(false);
    expect(isSessionIssuingRequest("/v1/auth/login", "GET")).toBe(false);
  });

  it("requires a complete refreshable token pair", () => {
    expect(isBackendTokenResponse(tokenResponse)).toBe(true);
    expect(isBackendTokenResponse({ ...tokenResponse, refresh_token: undefined })).toBe(false);
    expect(isBackendTokenResponse({ access_token: "only-access" })).toBe(false);
  });

  it("strips both credentials before returning data to the browser", () => {
    const safe = stripBackendTokens(tokenResponse);
    expect(safe).not.toHaveProperty("access_token");
    expect(safe).not.toHaveProperty("refresh_token");
    expect(safe).toMatchObject({ session_id: "session-1", user_id: "user-1" });
  });

  it("maps credentials only into server session data", () => {
    expect(serverSessionData(tokenResponse)).toEqual({
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      expiresAt: "2030-01-01T00:00:00Z",
      sessionId: "session-1",
      userId: "user-1",
      organizationId: "org-1",
      version: 1,
    });
  });
});
