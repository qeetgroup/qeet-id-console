// Settings the server resolves at runtime and hands to the browser before hydration, so one image
// serves every environment. Public values only: they are written into the page.

declare global {
  interface Window {
    __QEET_PUBLIC_CONFIG__?: PublicConfig;
  }
}

export interface PublicConfig {
  apiUrl?: string; // PUBLIC_API_URL
  flagsOff?: string[]; // CONSOLE_FLAGS_OFF: feature flags the deployment turned off
}

/** Returns the flag ids in a comma-separated list, trimmed and without empties. */
export function parseFlagList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Returns the public config: from the environment on the server, from the page in the browser. */
export function readPublicConfig(): PublicConfig {
  if (typeof window === "undefined") {
    return {
      apiUrl: process.env.PUBLIC_API_URL || undefined,
      flagsOff: parseFlagList(process.env.CONSOLE_FLAGS_OFF),
    };
  }
  return window.__QEET_PUBLIC_CONFIG__ ?? {};
}

/** Returns the script handing the server-resolved config to the browser. */
export function publicConfigScript(config: PublicConfig): string {
  return `window.__QEET_PUBLIC_CONFIG__=${JSON.stringify(config).replace(/</g, "\\u003c")};`;
}
