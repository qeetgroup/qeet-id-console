// This is the SSRF guard: matching control characters is the entire point, because CR/LF/NUL are
// precisely what a request-smuggling payload injects into a backend path.
// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the intent
const FORBIDDEN_PATH_CHARACTERS = /[\\?#\u0000-\u001f\u007f]/;

// A canonical API path is a plain path. An embedded scheme ("/https://attacker.example/x") stays
// on our own origin under WHATWG URL parsing, so the canonicalization check below does not catch
// it - but any downstream parser that re-reads the path could treat it as an absolute URL.
const EMBEDDED_SCHEME = /:\/\//;

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
