// Response headers for every route, set through Nitro route rules. The CSP enforces only what
// needs no script changes (no framing, no <base> rewrites, no plugins): a script and style policy
// needs per-request nonces for the inline theme, config and hydration scripts.
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  "X-Frame-Options": "DENY", // frame-ancestors for browsers that predate it
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Passkeys (publickey-credentials-*) and clipboard keep their same-origin default.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "X-Robots-Tag": "noindex, nofollow", // an operator console has nothing to index
};
