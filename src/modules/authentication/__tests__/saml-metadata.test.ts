// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { parseSamlMetadata } from "../saml-metadata";

const SIGNING_CERT = "MIIDsigningsigningsigning";
const ENCRYPTION_CERT = "MIIDencryptionencryption";

function metadata({
  entityId = 'entityID="http://www.okta.com/exk1abc"',
  services = `
      <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://acme.okta.com/app/post"/>
      <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://acme.okta.com/app/redirect"/>`,
  keys = `
      <md:KeyDescriptor use="encryption">
        <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
          <ds:X509Data><ds:X509Certificate>${ENCRYPTION_CERT}</ds:X509Certificate></ds:X509Data>
        </ds:KeyInfo>
      </md:KeyDescriptor>
      <md:KeyDescriptor use="signing">
        <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
          <ds:X509Data><ds:X509Certificate>
            ${SIGNING_CERT}
          </ds:X509Certificate></ds:X509Data>
        </ds:KeyInfo>
      </md:KeyDescriptor>`,
} = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" ${entityId}>
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">${keys}${services}
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`;
}

describe("parseSamlMetadata", () => {
  it("pulls the entity ID, redirect SSO URL and signing certificate", () => {
    const result = parseSamlMetadata(metadata());

    expect(result).toEqual({
      ok: true,
      metadata: {
        entityId: "http://www.okta.com/exk1abc",
        // HTTP-Redirect wins over the POST binding listed before it.
        ssoUrl: "https://acme.okta.com/app/redirect",
        // Line breaks and indentation inside the element are collapsed away.
        certificate: SIGNING_CERT,
      },
    });
  });

  it("falls back to the POST binding when there is no redirect endpoint", () => {
    const xml = metadata({
      services: `
      <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://acme.okta.com/app/post"/>`,
    });

    expect(parseSamlMetadata(xml)).toMatchObject({
      ok: true,
      metadata: { ssoUrl: "https://acme.okta.com/app/post" },
    });
  });

  it("reads metadata that carries no namespace prefix", () => {
    const xml = `<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="urn:example:idp">
      <IDPSSODescriptor>
        <KeyDescriptor use="signing"><X509Certificate>${SIGNING_CERT}</X509Certificate></KeyDescriptor>
        <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example/sso"/>
      </IDPSSODescriptor>
    </EntityDescriptor>`;

    expect(parseSamlMetadata(xml)).toEqual({
      ok: true,
      metadata: {
        entityId: "urn:example:idp",
        ssoUrl: "https://idp.example/sso",
        certificate: SIGNING_CERT,
      },
    });
  });

  it("uses the encryption key only when no signing key is published", () => {
    const xml = metadata({
      keys: `
      <md:KeyDescriptor use="encryption">
        <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
          <ds:X509Data><ds:X509Certificate>${ENCRYPTION_CERT}</ds:X509Certificate></ds:X509Data>
        </ds:KeyInfo>
      </md:KeyDescriptor>`,
    });

    expect(parseSamlMetadata(xml)).toMatchObject({
      ok: true,
      metadata: { certificate: ENCRYPTION_CERT },
    });
  });

  it.each([
    ["not xml at all", "invalidXml"],
    ["", "invalidXml"],
  ])("rejects %j", (input, reason) => {
    expect(parseSamlMetadata(input)).toEqual({ ok: false, reason });
  });

  it("reports the specific piece that is missing", () => {
    expect(parseSamlMetadata(metadata({ entityId: "" }))).toEqual({
      ok: false,
      reason: "missingEntityId",
    });
    expect(parseSamlMetadata(metadata({ services: "" }))).toEqual({
      ok: false,
      reason: "missingSsoUrl",
    });
    expect(parseSamlMetadata(metadata({ keys: "" }))).toEqual({
      ok: false,
      reason: "missingCertificate",
    });
  });
});
