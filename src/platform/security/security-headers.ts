// Response headers for every route, set through Nitro route rules. The Content-Security-Policy
// carries a per-request nonce, so src/start.ts sets it on each response instead
// (content-security-policy.ts).
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Frame-Options": "DENY", // frame-ancestors for browsers that predate it
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Passkeys (publickey-credentials-*) and clipboard keep their same-origin default.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "X-Robots-Tag": "noindex, nofollow", // an operator console has nothing to index
};
