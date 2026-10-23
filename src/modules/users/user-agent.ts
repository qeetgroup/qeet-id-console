import i18n from "@/i18n";

// Sessions store only the raw User-Agent, so this names its browser and OS on a best-effort basis;
// it is deliberately small, not a UA database.

export interface ParsedUserAgent {
  browser: string;
  os: string;
  label: string; // e.g. "Chrome on macOS"
}

export function parseUserAgent(ua?: string | null): ParsedUserAgent {
  if (!ua) {
    return {
      browser: i18n.t("users:userAgent.unknown"),
      os: i18n.t("users:userAgent.device"),
      label: i18n.t("users:userAgent.unknownDevice"),
    };
  }
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
              ? i18n.t("users:userAgent.apiClient")
              : i18n.t("users:userAgent.browser");
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
              : i18n.t("users:userAgent.unknownOs");
  return { browser, os, label: i18n.t("users:userAgent.label", { browser, os }) };
}
