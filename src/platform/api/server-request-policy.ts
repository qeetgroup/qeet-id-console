// SSRF guard: CR/LF/NUL are what a request-smuggling payload injects into a backend path.
// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
const FORBIDDEN_PATH_CHARACTERS = /[\\?#\u0000-\u001f\u007f]/;

// An embedded scheme ("/https://attacker.example/x") passes the origin check below under WHATWG
// parsing, but a downstream parser that re-reads the path could treat it as an absolute URL.
const EMBEDDED_SCHEME = /:\/\//;

/** Resolves an API path against the backend origin; throws if the path could leave it. */
export function buildBackendUrl(
  apiBaseUrl: string,
  path: string,
  query: Record<string, string | number> = {},
): URL {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    FORBIDDEN_PATH_CHARACTERS.test(path) ||
    EMBEDDED_SCHEME.test(path)
  ) {
    throw new Error("Invalid backend API path.");
  }

  const base = new URL(apiBaseUrl);
  const target = new URL(path, `${base.origin}/`);
  if (
    target.origin !== base.origin ||
    target.protocol !== base.protocol ||
    target.pathname !== path
  ) {
    throw new Error("Backend API path escaped its configured origin.");
  }

  for (const [key, value] of Object.entries(query)) {
    target.searchParams.set(key, String(value));
  }
  return target;
}

export function isLocalSessionDestroyRequest(pathname: string, method: string): boolean {
  return method === "POST" && pathname === "/v1/auth/logout";
}

// Signing out everywhere ends the console's own session too, so a successful call clears its
// cookie; after a failure the person stays signed in here and can retry.
export function isGlobalSignOutRequest(pathname: string, method: string): boolean {
  return method === "POST" && pathname === "/v1/auth/sessions/revoke-all";
}
