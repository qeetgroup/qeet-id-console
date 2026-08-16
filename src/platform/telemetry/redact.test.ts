import { describe, expect, it } from "vitest";

import { redact } from "./redact";

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
    // non-sensitive ids are preserved for correlation
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
    // "secret" key is denylisted → dropped; string value PII is masked.
    expect(out.items[0].secret).toBe("[redacted]");
    expect(out.items[0].note).toBe("[redacted-email]");
  });

  it("preserves opaque ids and non-sensitive scalars", () => {
    expect(redact("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(redact(42)).toBe(42);
    expect(redact(true)).toBe(true);
  });
});
