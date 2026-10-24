// Always the production hosts: the sign-in page is a public entry point, so its links must
// resolve for real visitors even when the console runs against a local backend.
const WEBSITE_URL = "https://id.qeet.in";

/** The hosted sign-in page (qeet-id-hosted), where an organization without its own domain signs in. */
export const HOSTED_SIGN_IN_HOST = "accounts.id.qeet.in";

export const DOCS_URL = "https://docs.id.qeet.in";
export const TERMS_URL = `${WEBSITE_URL}/legal/terms`;
export const PRIVACY_URL = `${WEBSITE_URL}/legal/privacy`;
export const SECURITY_URL = `${WEBSITE_URL}/security`;
export const PRICING_URL = `${WEBSITE_URL}/pricing`;
