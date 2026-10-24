import { describe, expect, it } from "vitest";

import type { Anomaly } from "@/modules/security";
import { isUser360Tab, USER360_TABS } from "../tabs";
import { parseUserAgent } from "../user-agent";
import { primaryRole, shortId, truncateId } from "../user-display";
import { deriveUserRisk } from "../user-risk";

const UA = {
  chromeMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.68",
  operaLinux:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 OPR/111.0.0.0",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  chromeOs:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  chromiumLinux:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/120.0.6099.71 Chrome/120.0.6099.71 Safari/537.36",
};

describe("parseUserAgent", () => {
  it("labels a missing user agent as an unknown device", () => {
    const unknown = { browser: "Unknown", os: "device", label: "Unknown device" };
    expect(parseUserAgent(undefined)).toEqual(unknown);
    expect(parseUserAgent(null)).toEqual(unknown);
    expect(parseUserAgent("")).toEqual(unknown);
  });

  it("names the browser and operating system of common desktop and mobile agents", () => {
    expect(parseUserAgent(UA.chromeMac)).toEqual({
      browser: "Chrome",
      os: "macOS",
      label: "Chrome on macOS",
    });
    expect(parseUserAgent(UA.edgeWindows).label).toBe("Edge on Windows");
    expect(parseUserAgent(UA.operaLinux).label).toBe("Opera on Linux");
    expect(parseUserAgent(UA.firefoxLinux).label).toBe("Firefox on Linux");
    expect(parseUserAgent(UA.chromeAndroid).label).toBe("Chrome on Android");
    expect(parseUserAgent(UA.chromeOs).label).toBe("Chrome on ChromeOS");
  });

  it("reports iOS for an iPhone even though its agent also mentions Mac OS X", () => {
    expect(parseUserAgent(UA.safariIphone).label).toBe("Safari on iOS");
  });

  it("does not report Chromium builds as Chrome", () => {
    expect(parseUserAgent(UA.chromiumLinux).label).toBe("Browser on Linux");
  });

  it("recognises scripted HTTP clients as an API client", () => {
    for (const ua of [
      "curl/8.4.0",
      "Wget/1.21.4",
      "python-requests/2.31.0",
      "Go-http-client/1.1",
      "PostmanRuntime/7.36.0",
      "okhttp/4.12.0",
    ]) {
      expect(parseUserAgent(ua).browser).toBe("API client");
    }
    expect(parseUserAgent("curl/8.4.0").label).toBe("API client on Unknown OS");
  });

  it("falls back to a generic browser on an unknown operating system", () => {
    expect(parseUserAgent("SomeAgent/1.0")).toEqual({
      browser: "Browser",
      os: "Unknown OS",
      label: "Browser on Unknown OS",
    });
  });
});

describe("primaryRole", () => {
  it("headlines the most privileged role, case-insensitively, keeping its original casing", () => {
    expect(primaryRole(["viewer", "member", "Admin", "developer"])).toBe("Admin");
    expect(primaryRole(["member", "OWNER", "admin"])).toBe("OWNER");
  });

  it("ranks custom roles below the known ones and keeps their order among themselves", () => {
    expect(primaryRole(["billing-manager", "viewer"])).toBe("viewer");
    expect(primaryRole(["billing-manager", "auditor"])).toBe("billing-manager");
  });

  it("returns null when the user has no roles", () => {
    expect(primaryRole([])).toBeNull();
    expect(primaryRole(null)).toBeNull();
    expect(primaryRole(undefined)).toBeNull();
  });

  it("does not reorder the caller's array", () => {
    const roles = ["viewer", "owner"];
    primaryRole(roles);
    expect(roles).toEqual(["viewer", "owner"]);
  });
});

describe("shortId", () => {
  it("keeps the first ten characters of a long id and marks the cut", () => {
    expect(shortId("6607bc8c-e084-4c1a-9f3e-4d285f1bfc61")).toBe("6607bc8c-e…");
  });

  it("leaves an id at or under the limit untouched", () => {
    expect(shortId("0123456789")).toBe("0123456789");
    expect(shortId("short")).toBe("short");
  });

  it("honours a custom head length", () => {
    expect(shortId("6607bc8c-e084", 4)).toBe("6607…");
  });
});

describe("truncateId", () => {
  it("keeps the head and tail of a long id", () => {
    expect(truncateId("6607bc8c-e084-4c1a-9f3e-4d285f1bfc61")).toBe("6607bc8c…bfc61");
  });

  it("leaves an id untouched when truncating would not save anything", () => {
    // head (8) + tail (5) + the ellipsis (1) = 14 characters.
    expect(truncateId("abcdefghijklmn")).toBe("abcdefghijklmn");
    expect(truncateId("abcdefghijklmno")).toBe("abcdefgh…klmno");
  });

  it("returns an empty string for an empty id", () => {
    expect(truncateId("")).toBe("");
  });

  it("honours custom head and tail lengths", () => {
    expect(truncateId("6607bc8c-e084-4c1a", 4, 2)).toBe("6607…1a");
  });
});

function anomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    id: "an-1",
    type: "credential_stuffing",
    severity: "low",
    detail: "Repeated failed sign-ins",
    status: "open",
    user_id: "user-1",
    created_at: "2026-10-01T10:00:00Z",
    resolved_at: null,
    ...overrides,
  };
}

describe("deriveUserRisk", () => {
  it("is low with no open signals when nothing was detected for the user", () => {
    expect(deriveUserRisk([], "user-1")).toEqual({ level: "low", openCount: 0 });
  });

  it("is high when any open anomaly for the user is high or critical", () => {
    expect(
      deriveUserRisk(
        [anomaly({ id: "a", severity: "low" }), anomaly({ id: "b", severity: "high" })],
        "user-1",
      ),
    ).toEqual({ level: "high", openCount: 2 });
    expect(deriveUserRisk([anomaly({ severity: "critical" })], "user-1").level).toBe("high");
  });

  it("is medium when the worst open anomaly is medium", () => {
    expect(
      deriveUserRisk(
        [anomaly({ id: "a", severity: "medium" }), anomaly({ id: "b", severity: "low" })],
        "user-1",
      ),
    ).toEqual({ level: "medium", openCount: 2 });
  });

  it("stays low but still counts open low-severity signals", () => {
    expect(deriveUserRisk([anomaly({ severity: "low" })], "user-1")).toEqual({
      level: "low",
      openCount: 1,
    });
  });

  it("ignores resolved anomalies and anomalies attributed to other users", () => {
    const feed = [
      anomaly({ id: "resolved-status", severity: "critical", status: "resolved" }),
      anomaly({
        id: "resolved-at",
        severity: "high",
        status: "open",
        resolved_at: "2026-10-02T10:00:00Z",
      }),
      anomaly({ id: "other-user", severity: "critical", user_id: "user-2" }),
      anomaly({ id: "unattributed", severity: "critical", user_id: null }),
    ];
    expect(deriveUserRisk(feed, "user-1")).toEqual({ level: "low", openCount: 0 });
    expect(deriveUserRisk(feed, "user-2")).toEqual({ level: "high", openCount: 1 });
  });

  it("counts an unresolved anomaly as open whatever its status, as the lockout's rate-limited", () => {
    const risk = deriveUserRisk(
      [anomaly({ severity: "critical", status: "rate-limited" })],
      "user-1",
    );
    expect(risk).toEqual({ level: "high", openCount: 1 });
  });
});

describe("User 360 tabs", () => {
  it("lists the workspace tabs in display order", () => {
    expect(USER360_TABS).toEqual([
      "overview",
      "security",
      "access",
      "sessions",
      "activity",
      "identities",
      "developer",
    ]);
  });

  it("accepts only known tab names from the ?tab= search param", () => {
    for (const tab of USER360_TABS) expect(isUser360Tab(tab)).toBe(true);
    expect(isUser360Tab("settings")).toBe(false);
    expect(isUser360Tab("Overview")).toBe(false);
    expect(isUser360Tab("")).toBe(false);
    expect(isUser360Tab(undefined)).toBe(false);
    expect(isUser360Tab(null)).toBe(false);
    expect(isUser360Tab(1)).toBe(false);
    expect(isUser360Tab(["overview"])).toBe(false);
  });
});
