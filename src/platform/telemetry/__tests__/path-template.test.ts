import { describe, expect, it } from "vitest";

import { pathTemplate } from "../path-template";

describe("pathTemplate", () => {
  it.each([
    [
      "/v1/users/550e8400-e29b-41d4-a716-446655440000/tenants/11111111-1111-4111-8111-111111111111/permissions",
      "/v1/users/{id}/tenants/{id}/permissions",
    ],
    ["/v1/auth/sessions/revoke-all", "/v1/auth/sessions/revoke-all"],
    ["/v1/passkeys/AbCdEfGhIjKlMnOpQrStUv", "/v1/passkeys/{id}"],
    ["/v1/invites/lookup/jane@acme.io", "/v1/invites/lookup/{id}"],
    ["/v1/tenants/acme/email-templates/password%2Dreset", "/v1/tenants/acme/email-templates/{id}"],
    ["/v1/webhooks/42/deliveries/9001/retry", "/v1/webhooks/{id}/deliveries/{id}/retry"],
    ["/v1/social/google/link/start", "/v1/social/google/link/start"],
    ["/oauth2/token", "/oauth2/token"],
  ])("templates %s", (path, template) => {
    expect(pathTemplate(path)).toBe(template);
  });

  it("drops the query string and fragment", () => {
    expect(pathTemplate("/reset-password?token=abc#top")).toBe("/reset-password");
  });

  it("keeps a route's own parameters and splat", () => {
    expect(pathTemplate("/users/$userId")).toBe("/users/$userId");
    expect(pathTemplate("/docs/$")).toBe("/docs/$");
    expect(pathTemplate("/")).toBe("/");
  });
});
