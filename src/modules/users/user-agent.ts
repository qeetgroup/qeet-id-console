// Best-effort User-Agent parsing for the User 360 sessions view (the sessions
// model stores only the raw UA string). Intentionally small — not a UA database.

export interface ParsedUserAgent {
  browser: string;
  os: string;
  /** "Chrome on macOS" */
  label: string;
}

/** Best-effort UA → {browser, os, label}. */
export function parseUserAgent(ua?: string | null): ParsedUserAgent {
  if (!ua) return { browser: "Unknown", os: "device", label: "Unknown device" };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua) && !/Chromium/.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Version\/.*Safari/.test(ua)
            ? "Safari"
            : /curl|wget|python|Go-http|PostmanRuntime|okhttp/i.test(ua)
              ? "API client"
              : "Browser";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "Unknown OS";
  return { browser, os, label: `${browser} on ${os}` };
}
