/**
 * Returns `fetch` with keepalive set, so a request to the console's own server sent as the page
 * is hidden or closed still completes. The browser caps keepalive bodies in flight at 64 KB.
 */
export function keepaliveFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, keepalive: true });
}
