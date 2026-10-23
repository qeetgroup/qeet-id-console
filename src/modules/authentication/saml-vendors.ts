// Infers which product is on the other end of a SAML connection, which stores no vendor, from the
// SSO URL's host and then the entity ID. It drives a filter, never a security decision.

export type SamlIdpVendor = "okta" | "entra" | "onelogin" | "google" | "pingidentity" | "other";

/** Proper nouns, so they stay untranslated; "other" is resolved through i18n. */
export const SAML_IDP_VENDOR_LABELS: Record<Exclude<SamlIdpVendor, "other">, string> = {
  okta: "Okta",
  entra: "Microsoft Entra ID",
  onelogin: "OneLogin",
  google: "Google Workspace",
  pingidentity: "Ping Identity",
};

const VENDOR_PATTERNS: [SamlIdpVendor, RegExp][] = [
  ["okta", /(^|\.)okta(preview)?\.com$|oktapreview|\bokta\b/i],
  ["entra", /microsoftonline\.com$|windows\.net$|microsoft\.com$|\bentra\b/i],
  ["onelogin", /onelogin\.com$|\bonelogin\b/i],
  ["google", /accounts\.google\.com$|google\.com$|\bgoogle\b/i],
  ["pingidentity", /pingone\.com$|pingidentity\.com$|\bping(one|identity)\b/i],
];

export function samlIdpVendor(connection: {
  idp_sso_url: string;
  idp_entity_id: string;
}): SamlIdpVendor {
  let host = "";
  try {
    host = new URL(connection.idp_sso_url).hostname;
  } catch {
    // A malformed SSO URL still leaves the issuer to match on.
  }
  // The host is the reliable signal; the issuer is the fallback, since it is
  // often a bare URN that only names the vendor in passing.
  return (
    (host ? VENDOR_PATTERNS.find(([, pattern]) => pattern.test(host))?.[0] : undefined) ??
    VENDOR_PATTERNS.find(([, pattern]) => pattern.test(connection.idp_entity_id))?.[0] ??
    "other"
  );
}
