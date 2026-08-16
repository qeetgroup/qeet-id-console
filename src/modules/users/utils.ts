// Pure helpers for the User 360 workspace: id truncation, best-effort
// User-Agent parsing (the sessions model stores only the raw UA string), and
// deriving a per-user risk level from the tenant's security anomalies.

import type { Anomaly } from "@/modules/security";

/** "6607bc8c-e084-…-4d285f1bfc61" → "6607bc8c…bfc61". */
export function truncateId(id: string, head = 8, tail = 5): string {
  if (!id) return "";
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export interface ParsedUserAgent {
  browser: string;
  os: string;
  /** "Chrome on macOS" */
  label: string;
}

/** Best-effort UA → {browser, os}. Intentionally small; not a UA database. */
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

export type RiskLevel = "low" | "medium" | "high";

export interface UserRisk {
  level: RiskLevel;
  /** Open (unresolved) anomalies attributed to this user. */
  openCount: number;
}

/**
 * Derive a user's risk level from the tenant anomaly feed: high/critical open
 * anomalies → high, medium → medium, otherwise low. No signals = low (the
 * healthy default), which is honest — anomalies are only written server-side
 * when something abnormal is detected.
 */
export function deriveUserRisk(anomalies: Anomaly[], userId: string): UserRisk {
  const open = anomalies.filter(
    (a) => a.user_id === userId && a.status !== "resolved" && !a.resolved_at,
  );
  if (open.length === 0) return { level: "low", openCount: 0 };
  const hasHigh = open.some((a) => a.severity === "high" || a.severity === "critical");
  const hasMedium = open.some((a) => a.severity === "medium");
  return { level: hasHigh ? "high" : hasMedium ? "medium" : "low", openCount: open.length };
}
