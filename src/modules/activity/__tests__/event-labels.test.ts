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
    expect(formatEventTitle({ type: "tenant.created" })).toBe("Organisation created");
    expect(formatEventTitle({ type: "auth.mfa_challenged" })).toBe("MFA challenge issued");
    expect(formatEventTitle({ type: "auth.mfa_enrollment_deferred" })).toBe("MFA setup postponed");
    expect(formatEventTitle({ type: "auth.mfa_verified" })).toBe("MFA verification succeeded");
  });

  it("words the sign-in and security events the log records most", () => {
    expect(formatEventTitle({ type: "auth.token_reuse_detected" })).toBe("Refresh token reused");
    expect(formatEventTitle({ type: "auth.sign_in_failed" })).toBe("Sign-in failed");
    expect(formatEventTitle({ type: "auth.sign_in_confirmed" })).toBe("Sign-in confirmed by email");
    expect(formatEventTitle({ type: "mfa.totp_enroll_started" })).toBe(
      "Authenticator app set-up started",
    );
    expect(formatEventTitle({ type: "role.assigned" })).toBe("Role assigned");
  });

  it("words invitations and data requests", () => {
    expect(formatEventTitle({ type: "invite.created" })).toBe("Invitation sent");
    expect(formatEventTitle({ type: "invite.declined" })).toBe("Invitation declined");
    expect(formatEventTitle({ type: "gdpr.erasure_requested" })).toBe("Data erasure requested");
    expect(formatEventTitle({ type: "gdpr.erasure_quarantined" })).toBe(
      "Data erasure held for review",
    );
    expect(formatEventTitle({ type: "gdpr.export_failed" })).toBe("Data export failed");
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
    expect(eventResult({ status: "blocked", severity: "warning" })).toBe("blocked");
    expect(eventResult({ status: "invalid_password", severity: "warning" })).toBe("failed");
  });

  it("derives the outcome from the action verb even at info severity", () => {
    expect(eventResult({ type: "auth.login_succeeded", severity: "info" })).toBe("success");
    expect(eventResult({ type: "tenant.created", severity: "info" })).toBe("success");
    expect(eventResult({ type: "auth.login_failed", severity: "warning" })).toBe("failed");
    expect(eventResult({ type: "auth.suspicious_detected", severity: "critical" })).toBe("blocked");
  });

  it("derives from severity when no status or verb is present", () => {
    expect(eventResult({ severity: "success" })).toBe("success");
    expect(eventResult({ severity: "critical" })).toBe("failed");
    expect(eventResult({ severity: "info" })).toBe("info");
  });
});
