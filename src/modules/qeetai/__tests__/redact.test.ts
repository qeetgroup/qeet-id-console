import { describe, expect, it } from "vitest";

import { maskPII } from "../redact";

describe("maskPII", () => {
  it("masks emails and IPv4 addresses, and keeps IDs", () => {
    expect(maskPII("jane.rao@acme.io signed in from 10.0.0.4 as u_123")).toBe(
      "[redacted-email] signed in from [redacted-ip] as u_123",
    );
    expect(maskPII("support+billing@mail.qeet.in")).toBe("[redacted-email]");
  });

  it("takes a long run with no address in one pass", () => {
    const started = performance.now();
    expect(maskPII("a".repeat(100_000))).toHaveLength(100_000);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
