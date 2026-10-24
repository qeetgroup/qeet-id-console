import { describe, expect, it } from "vitest";

import { redact } from "../redact";

describe("telemetry redact", () => {
  it("drops denylisted keys entirely", () => {
    const out = redact({
      access_token: "abc",
      refresh_token: "def",
      client_secret: "s",
      password: "p",
      api_key: "k",
      user_id: "u_123",
    }) as Record<string, unknown>;
    expect(out.access_token).toBe("[redacted]");
    expect(out.refresh_token).toBe("[redacted]");
    expect(out.client_secret).toBe("[redacted]");
    expect(out.password).toBe("[redacted]");
    expect(out.api_key).toBe("[redacted]");
    expect(out.user_id).toBe("u_123");
  });

  it("masks emails and IPs inside string values", () => {
    const out = redact({ note: "user jane@acme.io from 10.0.0.4 signed in" }) as Record<
      string,
      unknown
    >;
    expect(out.note).toBe("user [redacted-email] from [redacted-ip] signed in");
  });

  it("recurses into arrays and nested objects", () => {
    const out = redact({ items: [{ secret: "x", note: "a@b.co" }] }) as {
      items: Record<string, unknown>[];
    };
    expect(out.items[0]?.secret).toBe("[redacted]");
    expect(out.items[0]?.note).toBe("[redacted-email]");
  });

  it("masks token-shaped values inside strings", () => {
    const jwt = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ1c2VyLWEifQ.c2lnbmF0dXJlLWJ5dGVz";
    const refresh = "kq3vR8nZ0x_Yb7-LmP2tQ9sW4eA1cD6fH5jK8uN0oV3"; // 32 random bytes, base64url
    const out = redact(
      `failed with ${jwt}; Authorization: Bearer abc.def-123; spent ${refresh} at /reset?token=s3cr3t&next=%2F`,
    ) as string;
    expect(out).not.toContain(jwt);
    expect(out).not.toContain("abc.def-123");
    expect(out).not.toContain(refresh);
    expect(out).not.toContain("s3cr3t");
    expect(out).toContain("Bearer [redacted-token]");
    expect(out).toContain("/reset?[redacted-query]");
  });

  it("keeps a bundle chunk name and an ordinary question mark", () => {
    const frame =
      "at render (https://console.test/assets/sensitive-action-provider-BXYp1Ixz.js:1:20)";
    expect(redact(frame)).toBe(frame);
    expect(redact("Are you sure? It can't be undone")).toBe("Are you sure? It can't be undone");
  });

  it("preserves opaque ids and non-sensitive scalars", () => {
    expect(redact("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(redact(42)).toBe(42);
    expect(redact(true)).toBe(true);
  });
});
