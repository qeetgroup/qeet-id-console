import { env } from "@/platform/config/env";

// The public API origin, only for browser-facing federation and metadata URLs (data goes through
// the BFF). Read at runtime from PUBLIC_API_URL so one image serves every environment, and handed
// to the browser before hydration; the build-time VITE_API_URL is the fallback.

declare global {
  interface Window {
    __QEET_PUBLIC_CONFIG__?: { apiUrl?: string };
  }
}

const DEFAULT_API_URL = "http://localhost:4001";

/** Returns the public base URL of the Qeet ID API, without a trailing slash. */
export function getApiBaseUrl(): string {
  const value =
    typeof window === "undefined"
      ? process.env.PUBLIC_API_URL || env.VITE_API_URL || DEFAULT_API_URL
      : window.__QEET_PUBLIC_CONFIG__?.apiUrl || env.VITE_API_URL || DEFAULT_API_URL;
  return value.replace(/\/+$/, "");
}

/** Returns the script handing the server-resolved config to the browser. Public values only. */
export function publicConfigScript(): string {
  const config = JSON.stringify({ apiUrl: getApiBaseUrl() }).replace(/</g, "\\u003c");
  return `window.__QEET_PUBLIC_CONFIG__=${config};`;
}
