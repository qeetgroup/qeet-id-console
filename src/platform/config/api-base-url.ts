import { env } from "@/platform/config/env";

// Public API origin used only for browser-facing federation/metadata URLs.
// Authenticated data requests go through the same-origin Start BFF.
//
// Resolved at RUNTIME so one container image serves any environment (the
// qeet-id-deploy test kit runs the same image for QA and UAT): the server reads
// PUBLIC_API_URL per request and RootDocument hands the same value to the
// browser before hydration (publicConfigScript). VITE_API_URL — inlined at
// build time — remains the fallback, which is what the Vercel deployment uses.

declare global {
  interface Window {
    __QEET_PUBLIC_CONFIG__?: { apiUrl?: string };
  }
}

const DEFAULT_API_URL = "http://localhost:4001";

/** Base URL of the Qeet ID API, without a trailing slash. */
export function getApiBaseUrl(): string {
  const value =
    typeof window === "undefined"
      ? process.env.PUBLIC_API_URL || env.VITE_API_URL || DEFAULT_API_URL
      : window.__QEET_PUBLIC_CONFIG__?.apiUrl || env.VITE_API_URL || DEFAULT_API_URL;
  return value.replace(/\/+$/, "");
}

/** Inline script handing the server-resolved public config to the browser. Public values only. */
export function publicConfigScript(): string {
  const config = JSON.stringify({ apiUrl: getApiBaseUrl() }).replace(/</g, "\\u003c");
  return `window.__QEET_PUBLIC_CONFIG__=${config};`;
}
