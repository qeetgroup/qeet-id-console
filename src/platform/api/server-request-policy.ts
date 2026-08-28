const FORBIDDEN_PATH_CHARACTERS = /[\\?#\u0000-\u001f\u007f]/;

export function buildBackendUrl(
  apiBaseUrl: string,
  path: string,
  query: Record<string, string | number> = {},
): URL {
  if (!path.startsWith("/") || path.startsWith("//") || FORBIDDEN_PATH_CHARACTERS.test(path)) {
    throw new Error("Invalid backend API path.");
  }

  const base = new URL(apiBaseUrl);
  const target = new URL(path, `${base.origin}/`);
  if (target.origin !== base.origin || target.protocol !== base.protocol || target.pathname !== path) {
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
