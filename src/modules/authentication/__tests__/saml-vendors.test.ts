import { describe, expect, it } from "vitest";

import { samlIdpVendor } from "../saml-vendors";

function connection(idp_sso_url: string, idp_entity_id = "urn:example:idp") {
  return { idp_sso_url, idp_entity_id };
}

describe("samlIdpVendor", () => {
  it.each([
    ["https://acme.okta.com/app/exk1abc/sso/saml", "okta"],
    ["https://acme.oktapreview.com/app/exk1abc/sso/saml", "okta"],
    ["https://login.microsoftonline.com/tenant-id/saml2", "entra"],
    ["https://acme.onelogin.com/trust/saml2/http-post/sso/123", "onelogin"],
    ["https://accounts.google.com/o/saml2/idp?idpid=abc", "google"],
    ["https://auth.pingone.com/env/saml20/idp/sso", "pingidentity"],
    ["https://sso.internal.example.com/saml", "other"],
  ])("reads %s as %s", (url, expected) => {
    expect(samlIdpVendor(connection(url))).toBe(expected);
  });

  it("falls back to the issuer when the SSO URL is unusable", () => {
    expect(samlIdpVendor(connection("not a url", "http://www.okta.com/exk1abc"))).toBe("okta");
    expect(samlIdpVendor(connection("", "urn:nothing:known"))).toBe("other");
  });

  it("prefers the host over a misleading issuer", () => {
    expect(
      samlIdpVendor(connection("https://acme.onelogin.com/sso", "http://www.okta.com/x")),
    ).toBe("onelogin");
  });
});
