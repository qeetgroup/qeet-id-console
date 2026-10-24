import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, createNonce } from "../content-security-policy";

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split(";").map((part) => {
      const [name = "", ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

describe("content security policy", () => {
  it("makes a fresh 128-bit nonce each time", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(atob(nonce)).toHaveLength(16);
  });

  it("runs only scripts carrying the response's nonce", () => {
    const policy = directives(contentSecurityPolicy("abc123"));
    const scripts = policy.get("script-src") ?? [];
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    // No inline handlers, no eval, and no host a script could be fetched from.
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(scripts.filter((s) => !s.startsWith("'"))).toEqual([]);
  });

  it("talks only to this origin, can't be framed and loads no plugins", () => {
    const policy = directives(contentSecurityPolicy("n"));
    expect(policy.get("connect-src")).toEqual(["'self'"]);
    expect(policy.get("frame-ancestors")).toEqual(["'none'"]);
    expect(policy.get("frame-src")).toEqual(["'none'"]);
    expect(policy.get("object-src")).toEqual(["'none'"]);
    expect(policy.get("base-uri")).toEqual(["'self'"]);
    expect(policy.get("form-action")).toEqual(["'self'"]);
  });
});
