// Reads IdP metadata XML in the browser into the fields a SAML connection stores. Nothing is
// uploaded and no metadata URL is fetched: the SSRF guard in server-request-policy.ts forbids it.
// Lookups ignore the namespace, since IdPs use the `md:` prefix, `saml2:` or none.

const REDIRECT_BINDING = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect";
const POST_BINDING = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST";

export interface ParsedSamlMetadata {
  entityId: string;
  ssoUrl: string;
  certificate: string;
}

/** Why an import failed, mapped to user-facing copy by the caller. */
export type SamlMetadataProblem =
  | "invalidXml"
  | "missingEntityId"
  | "missingSsoUrl"
  | "missingCertificate";

export type SamlMetadataResult =
  | { ok: true; metadata: ParsedSamlMetadata }
  | { ok: false; reason: SamlMetadataProblem };

function elements(doc: Document, tag: string): Element[] {
  return Array.from(doc.getElementsByTagNameNS("*", tag));
}

/**
 * Returns the signing certificate: a key marked "signing", else one with no `use` (it serves
 * both), else any key, so an encryption-only key is a last resort rather than a failure.
 */
function signingCertificate(doc: Document): string {
  const descriptors = elements(doc, "KeyDescriptor");
  const preferred =
    descriptors.find((d) => d.getAttribute("use") === "signing") ??
    descriptors.find((d) => !d.getAttribute("use")) ??
    descriptors[0];

  const scope = preferred ?? doc.documentElement;
  const node = Array.from(scope.getElementsByTagNameNS("*", "X509Certificate"))[0];
  // Certificates wrap across lines in metadata; the backend accepts PEM or bare
  // base64, so collapsing the whitespace gives it the latter.
  return (node?.textContent ?? "").replace(/\s+/g, "");
}

export function parseSamlMetadata(xml: string): SamlMetadataResult {
  const trimmed = xml.trim();
  if (!trimmed) return { ok: false, reason: "invalidXml" };

  const doc = new DOMParser().parseFromString(trimmed, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    return { ok: false, reason: "invalidXml" };
  }

  const descriptor = elements(doc, "EntityDescriptor")[0];
  const entityId = descriptor?.getAttribute("entityID")?.trim() ?? "";
  if (!entityId) return { ok: false, reason: "missingEntityId" };

  const services = elements(doc, "SingleSignOnService");
  const service =
    services.find((s) => s.getAttribute("Binding") === REDIRECT_BINDING) ??
    services.find((s) => s.getAttribute("Binding") === POST_BINDING) ??
    services[0];
  const ssoUrl = service?.getAttribute("Location")?.trim() ?? "";
  if (!ssoUrl) return { ok: false, reason: "missingSsoUrl" };

  const certificate = signingCertificate(doc);
  if (!certificate) return { ok: false, reason: "missingCertificate" };

  return { ok: true, metadata: { entityId, ssoUrl, certificate } };
}
