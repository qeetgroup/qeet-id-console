import { describe, expect, it } from "vitest";

import { eventResult, formatEventTitle, humanizeEventType } from "../event-labels";

describe("formatEventTitle", () => {
  it("maps a known enum to its human title", () => {
    expect(formatEventTitle({ type: "auth.login.succeeded" })).toBe("Successful sign-in");
    expect(formatEventTitle({ type: "user.mfa.required.enabled" })).toBe("MFA requirement enabled");
  });

  it("normalizes the backend's underscore-segment enums", () => {
    // Real server shape: domain.action_with_underscores.
    expect(formatEventTitle({ type: "auth.login_succeeded" })).toBe("Successful sign-in");
    expect(formatEventTitle({ type: "user.mfa_required_set" })).toBe("MFA requirement enabled");
    expect(formatEventTitle({ type: "tenant.created" })).toBe("Organization created");
  });

  it("never leaks an enum-shaped server title", () => {
    expect(formatEventTitle({ type: "auth.login.succeeded", title: "Auth Login_succeeded" })).toBe(
      "Successful sign-in",
    );
    // Unknown type with an enum-shaped title → humanized enum, not the raw title.
    expect(formatEventTitle({ type: "widget.frobnicated", title: "widget_frobnicated" })).toBe(
      "Widget frobnicated",
    );
  });

  it("trusts a human-looking server title for unknown types", () => {
    expect(formatEventTitle({ type: "custom.thing", title: "Custom thing happened" })).toBe(
      "Custom thing happened",
    );
  });

  it("humanizes an unknown enum with no title", () => {
    expect(humanizeEventType("user.password.changed")).toBe("User password changed");
  });
});

describe("eventResult", () => {
  it("prefers explicit status over severity", () => {
    expect(eventResult({ status: "blocked", severity: "warning" })).toBe("Blocked");
    expect(eventResult({ status: "invalid_password", severity: "warning" })).toBe("Failed");
  });

  it("derives the outcome from the action verb even at info severity", () => {
    // A successful login is logged at info severity — it must still read Success.
    expect(eventResult({ type: "auth.login_succeeded", severity: "info" })).toBe("Success");
    expect(eventResult({ type: "tenant.created", severity: "info" })).toBe("Success");
    expect(eventResult({ type: "auth.login_failed", severity: "warning" })).toBe("Failed");
    expect(eventResult({ type: "auth.suspicious_detected", severity: "critical" })).toBe("Blocked");
  });

  it("derives from severity when no status or verb is present", () => {
    expect(eventResult({ severity: "success" })).toBe("Success");
    expect(eventResult({ severity: "critical" })).toBe("Failed");
    expect(eventResult({ severity: "info" })).toBe("Info");
  });
});
