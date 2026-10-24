// The Content-Security-Policy for every response the console renders. Scripts run only with the
// request's nonce, which the router puts on every script it renders; 'strict-dynamic' lets them
// load their own chunks and workers, so no host needs allowing. Set per request in src/start.ts.

/** Returns a fresh nonce: 128 random bits, base64. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** Returns the policy for a response whose scripts carry `nonce`. */
export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    // 'self' is for browsers without 'strict-dynamic', which ignore it otherwise.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Style attributes from React and the design system, and Monaco's injected styles. Unlike
    // scripts, styles can't run code.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:", // organization logos and avatars live on other hosts
    "font-src 'self' data:",
    "connect-src 'self'", // the browser talks only to this console's server
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}
