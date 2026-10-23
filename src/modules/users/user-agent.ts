// Sessions store only the raw User-Agent, so this names its browser and OS on a best-effort basis;
// it is deliberately small, not a UA database.

export interface ParsedUserAgent {
  browser: string;
  os: string;
  label: string; // e.g. "Chrome on macOS"
}

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
