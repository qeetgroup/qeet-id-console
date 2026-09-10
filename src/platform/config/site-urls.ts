// Public marketing and docs destinations the auth chrome links out to. These
// are always the production hosts — the sign-in page is a public entry point,
// so its Terms/Privacy/Security links must resolve for real visitors even when
// the console itself is running against a local backend.
const WEBSITE_URL = "https://id.qeet.in";

export const DOCS_URL = "https://docs.id.qeet.in";
export const TERMS_URL = `${WEBSITE_URL}/legal/terms`;
export const PRIVACY_URL = `${WEBSITE_URL}/legal/privacy`;
export const SECURITY_URL = `${WEBSITE_URL}/security`;
export const PRICING_URL = `${WEBSITE_URL}/pricing`;
