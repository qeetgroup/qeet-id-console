import { env } from "@/platform/config/env";
import { publicConfigScript as script, readPublicConfig } from "@/platform/config/public-config";

// The public API origin, only for browser-facing federation and metadata URLs (data goes through
// the BFF). Read at runtime from PUBLIC_API_URL so one image serves every environment, and handed
// to the browser before hydration; the build-time VITE_API_URL is the fallback.

const DEFAULT_API_URL = "http://localhost:4001";

/** Returns the public base URL of the Qeet ID API, without a trailing slash. */
export function getApiBaseUrl(): string {
  const value = readPublicConfig().apiUrl || env.VITE_API_URL || DEFAULT_API_URL;
  return value.replace(/\/+$/, "");
}

/** Returns the script handing the server-resolved config to the browser. Public values only. */
export function publicConfigScript(): string {
  return script({ apiUrl: getApiBaseUrl(), flagsOff: readPublicConfig().flagsOff ?? [] });
}
